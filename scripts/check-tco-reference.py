"""Independent Decimal oracle for the checked-in TCO examples; no imports from the PHP/React implementation."""
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

cases = json.loads((Path(__file__).resolve().parents[1] / 'server/tests/fixtures/week4-tco-cases.json').read_text(encoding='utf-8'))
for case in cases:
    years = Decimal(case['years'])
    cycles = Decimal(case['uses']) * 52 * years
    if 'annualKwh' in case:
        kwh, cubic_meters = Decimal(case['annualKwh']) * years, Decimal(0)
    else:
        kw = Decimal(case['power']) / (1000 if case['powerUnit'] == 'W' else 1)
        kwh = kw * Decimal(case['hours']) * cycles
        cubic_meters = Decimal(case['water']) / (1000 if case['waterUnit'] == 'L' else 1) * cycles
    rounded = lambda value: value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    electricity, water = rounded(kwh * 3000), rounded(cubic_meters * 25000)
    total = Decimal('1000000') + electricity + water + (Decimal(case['annualConsumables']) + Decimal(case['annualMaintenance'])) * years
    actual = dict(electricity=f'{electricity:.2f}', water=f'{water:.2f}', total=f'{total:.2f}')
    assert actual == case['expected'], (case['name'], actual, case['expected'])
    print(f"PASS independent TCO: {case['name']} -> {actual['total']} VND")
