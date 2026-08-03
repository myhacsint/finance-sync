import unittest

from dkb_fints_helper import parse_mt535


class ParseMt535Test(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
