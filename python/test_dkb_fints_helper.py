import unittest
from dkb_transactions import parse_mt536

from dkb_fints_helper import (
    continuation,
    parse_mt535,
    restore_challenge_for_resume,
    restore_tan_for_resume,
    swift_decimal,
    attach_turnovers,
)


class ParseMt536Test(unittest.TestCase):
    def fixture(self):
        return '\n'.join([':16R:FIN', ':35B:ISIN US0378331005', ':16R:TRAN',
            ':20C::RELA//synthetic-reference', ':36B::PSTA//UNIT/3,',
            ':19A::PSTA//NEUR300,', ':22H::REDE//RECE',
            ':98C::ESET//20260820120000', ':16S:TRAN', ':16S:FIN'])

    def test_observation_is_not_inferred_purchase(self):
        value = parse_mt536(self.fixture())[0]
        self.assertEqual(value['direction'], 'RECE')
        self.assertEqual(value['quantity'], '3')
        self.assertEqual(value['amount'], '300')
        self.assertNotIn('fee', value)
        self.assertNotIn('BUY', value.values())

    def test_stable_identity_independent_of_report_envelope(self):
        a = parse_mt536(self.fixture())[0]
        b = parse_mt536(':20C::SEME//other-report\n' + self.fixture())[0]
        self.assertEqual(a['identity'], b['identity'])

    def test_missing_reference_and_truncation_rejected(self):
        for raw in [self.fixture().replace(':20C::RELA//synthetic-reference', ''),
                    self.fixture().replace(':16S:TRAN', ''),
                    self.fixture().replace('UNIT/3,', 'UNIT/0,')]:
            with self.assertRaises(ValueError): parse_mt536(raw)

    def test_duplicate_conflicting_field_rejected(self):
        with self.assertRaises(ValueError):
            parse_mt536(self.fixture().replace(':16S:TRAN', ':36B::PSTA//UNIT/7,\n:16S:TRAN'))

    def test_no_turnovers_is_valid(self):
        self.assertEqual(parse_mt536(':16R:GENL\n:16S:GENL'), [])

    def test_response_attachment_uses_transaction_payload(self):
        from types import SimpleNamespace
        portfolio = {}
        attach_turnovers(portfolio, [SimpleNamespace(transactions=self.fixture().encode())])
        self.assertEqual(len(portfolio['turnovers']), 1)
        self.assertEqual(portfolio['rawMt536'], [self.fixture()])


class ParseMt535Test(unittest.TestCase):
    def test_accepts_swift_decimal_marker_without_fraction(self):
        self.assertEqual(swift_decimal("100,"), "100")
        self.assertEqual(swift_decimal("N26,"), "-26")

    def test_preserves_decimal_precision_and_continuation_name(self):
        raw = """
:16R:FIN
:35B:ISIN DE0007164600|/DE/716460|SAP
 SE
:90B::MRKT//ACTU/EUR191,1250
:98A::PRIC//20260803
:93B::AGGR//UNIT/12,34567
:19A::HOLD//EUR2359,94
:16S:FIN
-
"""
        self.assertEqual(parse_mt535(raw), [{
            "isin": "DE0007164600",
            "name": "SAP SE",
            "priceCurrency": "EUR",
            "price": "191.1250",
            "valuationDate": "2026-08-03",
            "quantity": "12.34567",
            "marketValueCurrency": "EUR",
            "marketValue": "2359.94",
        }])

    def test_requires_isin_and_quantity(self):
        with self.assertRaisesRegex(ValueError, "Unvollständige Position"):
            parse_mt535(":16R:FIN\n:35B:ISIN DE0007164600\n:16S:FIN")


class ContinuationStateTest(unittest.TestCase):
    def test_persists_allowed_tan_methods_without_pin(self):
        class Client:
            def deconstruct(self, including_private=False):
                self.including_private = including_private
                return b"opaque-no-pin"

        class Challenge:
            decoupled = True

            def get_data(self):
                return b"tan-state"

        client = Client()
        state = continuation(client, Challenge(), b"dialog", "init", 0, [])
        self.assertTrue(client.including_private)
        self.assertTrue(state["decoupled"])
        self.assertNotIn("pin", state)

    def test_restores_configured_tan_method_for_older_state(self):
        class Client:
            allowed_security_functions = []

            def set_tan_mechanism(self, value):
                self.selected = value

        client = Client()
        restore_tan_for_resume(client, {"tanMechanism": "940"})
        self.assertEqual(client.allowed_security_functions, ["940"])
        self.assertEqual(client.selected, "940")

    def test_restores_decoupled_flag_for_current_and_older_state(self):
        class Challenge:
            decoupled = False

        current = restore_challenge_for_resume(
            Challenge(), {"decoupled": True}, {"tanMechanism": "910"}
        )
        self.assertTrue(current.decoupled)

        older = restore_challenge_for_resume(
            Challenge(), {}, {"tanMechanism": "940"}
        )
        self.assertTrue(older.decoupled)


if __name__ == "__main__":
    unittest.main()
