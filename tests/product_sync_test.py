import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('sync_products', Path(__file__).resolve().parents[1] / 'scripts/sync-products.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        images = self.root / 'public/assets/missdiamond/ring'
        images.mkdir(parents=True)
        (images / 'DR001-A.jpg').write_bytes(b'fixture')
        self.config = {'legacyIds': {}, 'pendingMappings': {}, 'categories': {'DR':'ring'}, 'availableStatuses':['上架中'], 'styleTags':{}}
        self.row = dict.fromkeys(sync.FIELDS)
        self.row.update({'SKU':'DR001-A','商品名稱':'測試戒指','大分類':'DR','圖片檔名':'DR001-A\nDR001-A-2','官網售價':1000,'狀態':'上架中','主石':'無'})

    def run_plan(self, row=None, previous=None):
        return sync.plan([(2, row or self.row)], self.config, previous or {}, [], self.root)

    def test_repeat_is_identical_and_update_is_by_sku(self):
        first, report = self.run_plan()
        self.assertEqual(report['counts']['added'], 1)
        again, report = self.run_plan(previous=first)
        self.assertEqual(first, again)
        self.assertEqual(report['counts']['unchanged'], 1)
        row = dict(self.row, 官網售價=2000)
        changed, report = self.run_plan(row, first)
        self.assertEqual(report['counts']['updated'], 1)
        self.assertEqual(changed['DR001-A']['product']['price'], 2000)

    def test_missing_secondary_image_does_not_block(self):
        snapshot, report = self.run_plan()
        self.assertTrue(snapshot['DR001-A']['product']['available'])
        self.assertEqual(len(snapshot['DR001-A']['product']['images']), 1)
        self.assertEqual(report['counts']['unresolved'], 0)

    def test_blank_is_not_zero_or_none_stone(self):
        first, _ = self.run_plan()
        self.assertIsNone(first['DR001-A']['product']['stock'])
        self.assertEqual(first['DR001-A']['product']['mainStone'], '無')
        self.row['主石'] = None
        self.row['官網售價'] = None
        second, _ = self.run_plan(previous=first)
        self.assertIsNone(second['DR001-A']['product']['mainStone'])
        self.assertIsNone(second['DR001-A']['product']['price'])
        self.assertFalse(second['DR001-A']['product']['available'])

    def test_absent_sku_is_retained(self):
        first, _ = self.run_plan()
        self.row['SKU'] = 'DR002-B'
        second, report = self.run_plan(previous=first)
        self.assertEqual(second['DR001-A'], first['DR001-A'])
        self.assertEqual(report['retained'], ['DR001-A'])

    def test_unavailable_states_and_pending_are_not_in_edge_catalog(self):
        for status in ['售出', '歸還', '未知狀態']:
            self.row['狀態'] = status
            snapshot, _ = self.run_plan()
            self.assertFalse(snapshot['DR001-A']['product']['available'])
            self.assertNotIn('DR001-A', sync.render_outputs(snapshot)['supabase/functions/_shared/catalog.ts'])
        self.row['狀態'] = '上架中'
        self.config['pendingMappings']['DR001-A'] = 'mixed'
        snapshot, report = self.run_plan()
        self.assertEqual(report['counts']['unresolved'], 1)
        self.assertFalse(snapshot['DR001-A']['product']['available'])

    def test_private_columns_and_gold_are_not_in_browser_output(self):
        self.row.update({'成本':'PRIVATE_COST','備註':'PRIVATE_NOTE','金重(錢)':'0.65g'})
        snapshot, _ = self.run_plan()
        self.assertEqual(snapshot['DR001-A']['source']['金重(錢)'], '0.65g')
        outputs = sync.render_outputs(snapshot)
        self.assertNotIn('0.65g', outputs['src/configs/products.ts'])
        self.assertNotIn('PRIVATE_', json.dumps(outputs))

    def test_legacy_id_survives_and_main_image_missing_blocks(self):
        self.config['legacyIds']['DR001-A'] = 'r-01'
        snapshot, report = self.run_plan()
        self.assertEqual(snapshot['DR001-A']['product']['id'], 'r-01')
        self.assertEqual(report['counts']['updated'], 1)
        self.row['圖片檔名'] = 'MISSING\nDR001-A'
        snapshot, report = self.run_plan()
        self.assertEqual(snapshot['DR001-A']['product']['images'], [])
        self.assertEqual(report['counts']['unresolved'], 1)

    def test_duplicate_sku_and_reordered_xlsx_headers(self):
        # Minimal OOXML fixture, no third-party spreadsheet dependency required.
        from xml.sax.saxutils import escape
        ns = sync.NS['s']
        fields = list(reversed(sync.FIELDS))
        def excel_row(num, vals):
            cells = ''.join(f'<c r="{chr(65+i)}{num}" t="inlineStr"><is><t>{escape(str(v))}</t></is></c>' for i,v in enumerate(vals) if v is not None)
            return f'<row r="{num}">{cells}</row>'
        data = excel_row(1, fields) + excel_row(2, [self.row[f] for f in fields])
        path = self.root / 'test.xlsx'
        def write(data):
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr('xl/workbook.xml', f'<workbook xmlns="{ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="商品總表" r:id="r1"/></sheets></workbook>')
                z.writestr('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>')
                z.writestr('xl/worksheets/sheet1.xml', f'<worksheet xmlns="{ns}"><sheetData>{data}</sheetData></worksheet>')
        write(data)
        rows, _ = sync.read_xlsx(path)
        self.assertEqual(rows[0][1]['SKU'], 'DR001-A')
        write(data + excel_row(3, [self.row[f] for f in fields]))
        with self.assertRaisesRegex(ValueError, '重複 SKU'):
            sync.read_xlsx(path)

if __name__ == '__main__':
    unittest.main()
