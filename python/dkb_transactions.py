"""Read-only FinTS depot turnover support. No inferred trades or fees."""
import hashlib
import re
from datetime import datetime
from decimal import Decimal


def parse_mt536(raw):
    """Keep receive/deliver as observations, not automatically BUY/SELL.

    A free delivery or corporate action is not necessarily a purchase. Stable
    bank references are mandatory; ambiguous/unsupported records fail closed.
    """
    from dkb_fints_helper import collapse_mt535, swift_decimal
    result, instrument, transaction = [], None, None
    for clause in collapse_mt535(raw):
        if clause == ':16R:FIN':
            instrument = None
        elif clause.startswith(':35B:ISIN '):
            match = re.match(r'^:35B:ISIN\s+([A-Z]{2}[A-Z0-9]{9}\d)', clause)
            instrument = match.group(1) if match else None
        elif clause == ':16R:TRAN':
            if transaction is not None:
                raise ValueError('Verschachtelter Depotumsatz')
            transaction = {'isin': instrument}
        elif clause == ':16S:TRAN':
            if transaction is None:
                raise ValueError('Unvollständiger Depotumsatz')
            required = ('isin', 'reference', 'direction', 'quantity', 'date')
            if any(not transaction.get(k) for k in required):
                raise ValueError('Depotumsatz ohne eindeutige Pflichtfelder')
            if Decimal(transaction['quantity']) <= 0:
                raise ValueError('Ungültige Depotumsatzmenge')
            transaction['identity'] = hashlib.sha256(
                (transaction['isin'] + ':' + transaction['reference']).encode()
            ).hexdigest()
            result.append(transaction)
            transaction = None
        elif transaction is not None:
            def put(key, value):
                if key in transaction and transaction[key] != value:
                    raise ValueError('Mehrdeutiger Depotumsatz')
                transaction[key] = value
            match = re.match(r'^:20C::(?:RELA|TRRF)//([^|]+)$', clause)
            if match:
                # Prefer RELA only when no competing reference exists; no guessing.
                put('reference', match.group(1))
            match = re.match(r'^:36B::PSTA//UNIT/(.+)$', clause)
            if match: put('quantity', swift_decimal(match.group(1)))
            match = re.match(r'^:22H::REDE//(RECE|DELI)$', clause)
            if match: put('direction', match.group(1))
            match = re.match(r'^:98[AC]::ESET//(\d{8})(?:\d{6})?$', clause)
            if match: put('date', datetime.strptime(match.group(1), '%Y%m%d').date().isoformat())
            match = re.match(r'^:19A::PSTA//N?([A-Z]{3})(\d+(?:,\d*)?)$', clause)
            if match:
                put('currency', match.group(1))
                put('amount', swift_decimal(match.group(2)))
    if transaction is not None:
        raise ValueError('Abgeschnittener Depotumsatz')
    if ':16R:TRAN' in raw and not result:
        raise ValueError('Depotumsätze nicht erkennbar')
    return result


def segment_factory(config, account, start_date, end_date):
    from fints.segments.base import FinTS3Segment
    from fints.fields import DataElementField, DataElementGroupField
    from fints.formals import Account3
    from dkb_fints_helper import account_model

    class HKWDU5(FinTS3Segment):
        account = DataElementGroupField(type=Account3)
        all_accounts = DataElementField(type='jn')
        security_reference = DataElementField(type='an', required=False)
        start_date = DataElementField(type='dat', required=False)
        end_date = DataElementField(type='dat', required=False)
        max_entries = DataElementField(type='num', max_length=4, required=False)
        touchdown_point = DataElementField(type='an', max_length=35, required=False)

    class HIWDU5(FinTS3Segment):
        transactions = DataElementField(type='bin')

    count = [0]
    def factory(touchdown):
        count[0] += 1
        if count[0] > 100:
            raise ValueError('Depotumsatz-Seitenlimit erreicht')
        return HKWDU5(account=Account3.from_sepa_account(account_model(config, account)),
                      all_accounts=False, start_date=start_date, end_date=end_date,
                      touchdown_point=touchdown)
    return factory
