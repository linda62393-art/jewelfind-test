"""Read-only XLSX input; deterministic, SKU-based catalog sync using Python stdlib.
Default is dry-run. No network, Excel edits, Git or database operations.
"""
import argparse
import copy
import hashlib
import importlib.util
import posixpath
import json
import math
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
FIELDS = ['SKU', '商品名稱', '大分類', '小分類', '檯材質', '鍊材質', '主石', '主石重量',
          '配鑽', '配鑽重量', '金重(錢)', '官網售價', '庫存', '狀態', '商品特色', '商品描述', '商品規格', '圖片檔名']

def dump(value):
    return json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n'

def read_xlsx(path):
    """Read cached values, preserve explicit 無 versus blank; never evaluate formulas."""
    with zipfile.ZipFile(path) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(t.text or '' for t in el.findall('.//s:t', NS))
                       for el in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        rels = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        sheets = ET.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet', NS)
        sheet = next((s for s in sheets if s.attrib['name'] == '商品總表'), None)
        if sheet is None:
            raise ValueError('找不到 商品總表 工作表')
        target = rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
        target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        rows, errors = [], []
        for row in ET.fromstring(z.read(target)).findall('s:sheetData/s:row', NS):
            values = {}
            for c in row.findall('s:c', NS):
                col = re.sub(r'\d', '', c.attrib['r'])
                typ = c.attrib.get('t')
                v = c.find('s:v', NS)
                text = v.text if v is not None else None
                if typ == 's' and text is not None:
                    value = strings[int(text)]
                elif typ == 'inlineStr':
                    value = ''.join(t.text or '' for t in c.findall('.//s:t', NS))
                elif typ == 'e':
                    errors.append(c.attrib['r']); value = None
                elif typ in ('str', 'b'):
                    value = text
                elif text is not None:
                    number = float(text)
                    if not math.isfinite(number):
                        raise ValueError('非有限數字：' + c.attrib['r'])
                    value = int(number) if number.is_integer() else number
                else:
                    value = None
                    if c.find('s:f', NS) is not None:
                        errors.append(c.attrib['r'])
                values[col] = value.strip() or None if isinstance(value, str) else value
            rows.append((int(row.attrib['r']), values))
        headers = next((v for _, v in rows if 'SKU' in v.values()), None)
        if not headers:
            raise ValueError('缺少 SKU 標頭')
        normalized = {col: str(v).strip() for col, v in headers.items() if v is not None}
        if len(set(normalized.values())) != len(normalized):
            raise ValueError('重複欄位名稱')
        missing = set(FIELDS) - set(normalized.values())
        if missing:
            raise ValueError('缺少欄位：' + ', '.join(sorted(missing)))
        result, seen = [], set()
        for number, values in rows:
            row = {name: values.get(col) for col, name in normalized.items() if name in FIELDS}
            sku = row.get('SKU')
            if sku == 'SKU':
                continue
            if not sku:
                if row.get('商品名稱') or row.get('圖片檔名'):
                    raise ValueError(f'第 {number} 列有商品但缺少 SKU')
                continue
            if not isinstance(sku, str) or not re.fullmatch(r'[A-Z0-9][A-Z0-9_-]{0,79}', sku):
                raise ValueError(f'第 {number} 列 SKU 格式不正確')
            if sku in seen:
                raise ValueError('重複 SKU：' + sku)
            relevant_errors = [f'{col}{number}' for col, name in normalized.items() if name in FIELDS and f'{col}{number}' in errors]
            if relevant_errors:
                raise ValueError('商品欄位有公式錯誤或未快取：' + ', '.join(relevant_errors))
            seen.add(sku); result.append((number, row))
        if not result:
            raise ValueError('沒有有效 SKU，停止同步')
        return result, errors


def embedded_images(path, rows):
    """Resolve Excel value metadata to each row's in-cell photo."""
    result = {}
    cleaner_spec = importlib.util.spec_from_file_location('image_metadata', ROOT / 'scripts/sanitize-product-images.py')
    cleaner = importlib.util.module_from_spec(cleaner_spec)
    cleaner_spec.loader.exec_module(cleaner)
    with zipfile.ZipFile(path) as z:
        metadata = ET.fromstring(z.read('xl/metadata.xml'))
        value_meta = metadata.find('s:valueMetadata', NS)
        future = metadata.find("s:futureMetadata[@name='XLRICHVALUE']", NS)
        rich = list(ET.fromstring(z.read('xl/richData/rdrichvalue.xml')))
        rich_rels = list(ET.fromstring(z.read('xl/richData/richValueRel.xml')))
        rels = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(z.read('xl/richData/_rels/richValueRel.xml.rels'))}
        sheets = ET.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet', NS)
        sheet = next(s for s in sheets if s.attrib['name'] == '商品總表')
        wb_rels = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        target = wb_rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
        target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        by_row = {number: row for number, row in rows}
        for row in ET.fromstring(z.read(target)).findall('s:sheetData/s:row', NS):
            item = by_row.get(int(row.attrib['r']))
            if not item: continue
            cells = [c for c in row.findall('s:c', NS) if 'vm' in c.attrib]
            if len(cells) != 1: raise ValueError('每件商品須有一張內嵌主圖：' + item['SKU'])
            meta_index = int(cells[0].attrib['vm']) - 1
            future_index = int(value_meta[meta_index][0].attrib['v'])
            rich_index = int(next(e for e in future[future_index].iter() if e.tag.endswith('}rvb')).attrib['i'])
            rel_index = int(rich[rich_index][0].text)
            rel_id = rich_rels[rel_index].attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            image_path = posixpath.normpath('xl/richData/' + rels[rel_id])
            extension = Path(image_path).suffix.lower()
            if extension not in ('.jpeg', '.jpg', '.png'): raise ValueError('Unsupported embedded image')
            relative = 'assets/missdiamond/imported/' + item['SKU'] + extension
            raw = z.read(image_path)
            result[relative] = cleaner.clean_png(raw) if extension == '.png' else cleaner.clean_jpeg(raw)
    return result

def images_for(row, root, config):
    index = {}
    for p in sorted((root / 'public/assets/missdiamond').rglob('*')):
        if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp'):
            index.setdefault(p.stem, []).append(p)
    requested = re.split(r'[\r\n]+', row['圖片檔名'] or '')
    images, missing = [], []
    for name in requested:
        name = name.strip()
        if not name:
            continue
        stem = Path(name).stem if Path(name).suffix.lower() in ('.jpg', '.png', '.jpeg', '.webp') else name
        choices = index.get(stem, [])
        if choices:
            selected = sorted(choices, key=lambda p: (p.suffix.lower() != '.jpg', str(p)))[0]
            images.append(selected.relative_to(root / 'public').as_posix())
        else:
            missing.append(name)
    # A missing primary image cannot silently turn an unrelated image into the primary.
    primary = requested[0].strip() if requested else ''
    if primary in missing:
        images = []
    overrides = config.get('imageOverrides', {}).get(row['SKU'])
    if overrides:
        for image in overrides:
            resolved = (root / 'public' / image).resolve()
            if not resolved.is_relative_to((root / 'public/assets').resolve()) or not resolved.is_file():
                raise ValueError('圖片覆寫路徑無效：' + image)
        images = overrides
    return list(dict.fromkeys(images)), missing

def feature_tags(text):
    """Summarize only supported feature wording; never infer missing claims."""
    rules = [
        ('經典款', r'經典|歷久彌新'), ('簡約百搭', r'簡約|百搭'),
        ('氣質搭配', r'優雅|氣質'), ('日常配戴', r'日常|每日|每天|天天'),
        ('層次疊戴', r'疊戴|層次搭配'), ('紀念送禮', r'送禮|禮物|紀念'),
        ('花朵造型', r'花朵|花瓣|四葉花'), ('愛心設計', r'愛心|心形|心型'),
        ('幾何線條', r'幾何'), ('輕盈舒適', r'輕盈|輕巧|舒適'),
        ('俐落風格', r'俐落'), ('寬版設計', r'寬版'),
        ('立體層次', r'立體|多層次'), ('細緻鑲嵌', r'鑲嵌|微鑲|密鑲|鋪鑲'),
        ('閃耀光澤', r'閃耀|火彩|火光|光芒|光澤'),
        ('天然鑽石', r'天然(?:真鑽|鑽石|主鑽)'), ('三石設計', r'三石'),
        ('藍寶石', r'藍寶石'), ('V型線條', r'V型'),
    ]
    return [label for label, pattern in rules if re.search(pattern, text or '')][:3]


def make_product(row, config, root):
    sku = row['SKU']; issues = []
    images, missing = images_for(row, root, config)
    category = config['categories'].get(row['大分類'])
    price, stock = row['官網售價'], row['庫存']
    if price is not None and (isinstance(price, bool) or not isinstance(price, (int, float)) or price < 0):
        raise ValueError('官網售價格式錯誤：' + sku)
    if stock is not None and (not isinstance(stock, int) or stock < 0):
        raise ValueError('庫存格式錯誤：' + sku)
    if not row['商品名稱']: issues.append('缺商品名稱')
    if not category: issues.append('分類尚未對應')
    if not images: issues.append('缺主圖')
    if price is None: issues.append('缺官網售價')
    if sku in config['pendingMappings']: issues.append(config['pendingMappings'][sku])
    materials = []
    metal_codes = {'18KW':'18k-white-gold', '18KR':'18k-rose-gold', '18KY':'18k-yellow-gold'}
    for field in ('檯材質', '鍊材質'):
        if row[field] in metal_codes: materials.append(metal_codes[row[field]])
    if any('鑽' in (row[f] or '') for f in ('主石', '配鑽')): materials.append('diamond')
    if row['主石'] and '珍珠' in row['主石']: materials.append('pearl')
    # Public content excludes private gold-weight fields.
    specs = '｜'.join(f'{label}：{row[field]}' for field, label in [
        ('檯材質','材質'), ('鍊材質','鍊材質'), ('主石','主石'), ('主石重量','主石重量'),
        ('配鑽','配鑽'), ('配鑽重量','配鑽重量')] if row[field] is not None)
    if row.get('商品規格'):
        specs = '\n'.join(line for line in row['商品規格'].splitlines() if '金重' not in line).strip()
    # Keep Excel copy, but do not display lines explicitly disclosing gold weight.
    description = '\n'.join(line for line in (row['商品描述'] or '').splitlines() if '金重' not in line)
    # Known disagreement: row says 18KR but the paragraph says 14K.
    # Keep the original in the source snapshot; show only structured specs until corrected.
    if row['檯材質'] == '18KR' and '14K' in description:
        description = ''
    blocked_status = row['狀態'] not in config['availableStatuses'] or stock == 0
    return {
        'id': config['legacyIds'].get(sku, sku), 'sku': sku, 'name': row['商品名稱'] or sku,
        'category': category or 'other', 'materials': sorted(set(materials)),
        'styleTags': config.get('styleTags', {}).get(sku, []), 'price': price,
        'images': images, 'description': description, 'featureTags': feature_tags(row['商品特色']), 'specifications': specs,
        'availableLocations': ['台北市', '新北市'], 'mainStone': row['主石'],
        'mainStoneWeight': row['主石重量'], 'accentStone': row['配鑽'], 'accentStoneWeight': row['配鑽重量'],
        'metal': row['檯材質'], 'chainMetal': row['鍊材質'], 'stock': stock, 'sourceStatus': row['狀態'],
        'available': not issues and not blocked_status,
        'unavailableReason': '商品資料確認中' if issues else '目前暫不提供看貨媒合' if blocked_status else None,
    }, issues, missing

def plan(rows, config, previous, legacy, root):
    products = copy.deepcopy(previous)
    report = {'added': [], 'updated': [], 'unchanged': [], 'unresolved': [], 'warnings': [], 'retained': []}
    legacy_by_id = {p['id']: p for p in legacy}
    seen = set()
    for rownum, row in rows:
        sku = row['SKU']; seen.add(sku)
        public, issues, missing = make_product(row, config, root)
        # Only the explicit whitelist enters the snapshot: never cost, trade price, stores or notes.
        record = {'source': {k: row.get(k) for k in ('SKU', '商品名稱', '官網售價')}, 'product': public}
        prior_sku = next((old_sku for old_sku, new_sku in config.get('skuRenames', {}).items() if new_sku == sku), sku)
        old = previous.get(sku) or previous.get(prior_sku)
        if prior_sku != sku: products.pop(prior_sku, None)
        action = 'unchanged' if old == record else 'updated' if old or sku in config['legacyIds'] else 'added'
        entry = {'sku': sku, 'name': row['商品名稱'], 'row': rownum, 'issues': issues}
        if issues:
            report['unresolved'].append(entry)
        else:
            report[action].append(entry)
        if old != record:
            legacy_product = legacy_by_id.get(public['id'], {})
            before = old['source'] if old else {
                '商品名稱': legacy_product.get('name'), '官網售價': legacy_product.get('price'),
                '商品規格': legacy_product.get('specifications'), '商品描述': legacy_product.get('description'),
            }
            entry['changes'] = {k: {'before': before.get(k), 'after': v} for k, v in record['source'].items() if before.get(k) != v}
        if missing and public['images']:
            report['warnings'].append({'sku': sku, 'message': '缺其他角度照，已使用現有主圖', 'missing': missing})
        if public['stock'] is None:
            report['warnings'].append({'sku': sku, 'message': '庫存空白，保留未知；需管理員確認實際供貨'})
        if row.get('商品描述') and not public['description']:
            report['warnings'].append({'sku': sku, 'message': '商品描述與材質欄位矛盾或含金重，原文保留；頁面暫只顯示結構欄位'})
        products[sku] = record
    report['retained'] = sorted(set(previous) - seen - set(config.get('skuRenames', {})))
    ids = [v['product']['id'] for v in products.values()]
    if len(ids) != len(set(ids)):
        raise ValueError('商品 ID 對照重複，停止同步')
    report['counts'] = {key: len(report[key]) for key in ('added','updated','unchanged','unresolved','retained')}
    report['counts']['sourceSkus'] = len(rows)
    report['counts']['available'] = sum(v['product']['available'] for v in products.values())
    return dict(sorted(products.items())), report

def render_outputs(snapshot):
    products = [v['product'] for _, v in sorted(snapshot.items())]
    front = "// Generated by scripts/sync-products.py; edit Excel or catalog/sync-config.json.\nimport type { JewelryProduct } from '../types/product'\n\nconst products: JewelryProduct[] = " + dump(products).rstrip() + "\n\nexport const mockProducts: JewelryProduct[] = products.map(product => ({ ...product, images: product.images.map(path => import.meta.env.BASE_URL + path.split('/').map(encodeURIComponent).join('/')) }))\n"
    names = {p['id']:p['name'] for p in products if p['available']}
    server = '// Generated from the same SKU snapshot as the frontend. Only available products accept NEW requests.\nexport const productNames: Record<string, string> = ' + dump(names)
    return {'catalog/snapshot.json': dump(snapshot), 'src/configs/products.ts': front,
            'supabase/functions/_shared/catalog.ts': server,
            'supabase/functions/submit-viewing/index.ts': re.sub(r'export const productNames: Record<string, string> = \{[\s\S]*?\n\}', lambda match: 'export const productNames: Record<string, string> = ' + dump(names).rstrip(), (ROOT / 'supabase/functions/submit-viewing/index.ts').read_text(), count=1)}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('excel', type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--embedded-images', action='store_true')
    parser.add_argument('--report', default='outputs/product-sync/latest.json')
    args = parser.parse_args()
    config = json.loads((ROOT / 'catalog/sync-config.json').read_text(encoding='utf-8'))
    snapshot_path = ROOT / 'catalog/snapshot.json'
    previous = json.loads(snapshot_path.read_text(encoding='utf-8')) if snapshot_path.exists() else {}
    legacy = json.loads((ROOT / 'catalog/legacy-products.json').read_text(encoding='utf-8'))
    rows, errors = read_xlsx(args.excel)
    if args.embedded_images:
        images = embedded_images(args.excel, rows)
        if not args.apply: raise ValueError('內嵌圖片匯入需搭配 --apply')
        for relative, content in images.items():
            path = ROOT / 'public' / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
    snapshot, report = plan(rows, config, previous, legacy, ROOT)
    report['sourceHash'] = hashlib.sha256(args.excel.read_bytes()).hexdigest()
    report['ignoredExcelErrors'] = errors
    report['applied'] = args.apply
    report_path = (ROOT / args.report).resolve()
    if not report_path.is_relative_to((ROOT / 'outputs').resolve()):
        raise ValueError('報告只能寫入忽略的 outputs 目錄')
    outputs = render_outputs(snapshot)  # Fully validate before touching catalog files.
    if args.apply:
        for relative, value in outputs.items():
            path = ROOT / relative
            if not path.exists() or path.read_text(encoding='utf-8') != value:
                path.parent.mkdir(parents=True, exist_ok=True)
                temporary = path.with_suffix(path.suffix + '.sync-tmp')
                temporary.write_text(value, encoding='utf-8')
                temporary.replace(path)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(dump(report), encoding='utf-8')
    print(dump(report['counts']))
    print('Applied locally.' if args.apply else 'Dry-run only. No catalog files changed.')

if __name__ == '__main__':
    try: main()
    except (ValueError, OSError, KeyError, zipfile.BadZipFile) as error:
        print('Sync stopped: ' + str(error), file=sys.stderr); sys.exit(1)
