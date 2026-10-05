"""Read a product workbook into a PRIVATE JSON import payload (no workbook edits).

Usage: python3 scripts/prepare-inventory-import.py workbook.xlsx /private/output.json
Never commit the payload or source workbook to a public repository.
"""
import json
import re
import sys
import zipfile
from decimal import Decimal, InvalidOperation
from pathlib import Path
from xml.etree import ElementTree as ET


def inventory(path):
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    records = []
    seen = set()
    with zipfile.ZipFile(path) as archive:
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            shared = [''.join(x.itertext()) for x in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        for sheet in archive.namelist():
            if not re.fullmatch(r'xl/worksheets/sheet\d+\.xml', sheet):
                continue
            headers = None
            for row in ET.fromstring(archive.read(sheet)).findall('s:sheetData/s:row', ns):
                cells = {}
                for cell in row.findall('s:c', ns):
                    column = re.sub(r'\d', '', cell.attrib['r'])
                    value = cell.find('s:v', ns)
                    text = value.text or '' if value is not None else ''
                    if cell.get('t') == 's':
                        text = shared[int(text)] if text else ''
                    elif cell.get('t') == 'inlineStr':
                        text = ''.join(cell.find('s:is', ns).itertext())
                    cells[column] = text.strip()
                if headers is None:
                    if 'SKU' in cells.values() and '寄售店家' in cells.values():
                        headers = {value: column for column, value in cells.items()}
                    continue
                value = lambda name: cells.get(headers.get(name), '')
                sku = value('SKU')
                if not sku:
                    continue
                if sku.upper() in seen:
                    raise ValueError(f'Duplicate SKU: {sku}; resolve before importing')
                seen.add(sku.upper())
                if len(sku) > 200:
                    raise ValueError('SKU too long')
                stock = None
                if value('庫存'):
                    try:
                        number = Decimal(value('庫存'))
                        if number.is_finite():
                            stock = str(number)
                    except InvalidOperation:
                        pass
                records.append({'sku': sku, 'model': sku.partition('-')[2] or sku,
                    'product_name': value('商品名稱'), 'consignment_store': value('寄售店家'),
                    'source_status': value('狀態'), 'stock': stock, 'source_file': Path(path).name})
    if not records:
        raise ValueError('No product rows with SKU and 寄售店家 headers')
    return records


if __name__ == '__main__':
    rows = inventory(sys.argv[1])
    Path(sys.argv[2]).write_text(json.dumps(rows, ensure_ascii=False), encoding='utf-8')
    print(f'{len(rows)} products; {sum(bool(x["consignment_store"]) for x in rows)} with stores')
