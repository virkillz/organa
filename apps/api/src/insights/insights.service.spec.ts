import { unknownNumbers } from './insights.service.js';

describe('unknownNumbers (guard on AI-written insight text)', () => {
  const facts = { total_kerugian: 'Rp12.766.750', porsi: '52%', kejadian: 316, periode: 'tahun 2026' };
  const section = (text: string) => [{ title: 'Unit Terbuang', bullets: [text] }];

  it('accepts numbers that appear in the facts, in any thousands format', () => {
    expect(unknownNumbers(section('Total kerugian Rp12.766.750 dari 316 kejadian (52%) pada 2026.'), facts)).toEqual([]);
  });

  it('flags invented numbers such as impact estimates', () => {
    expect(unknownNumbers(section('Diskon dapat menaikkan penjualan hingga 27% dan menghemat Rp1.000.000.'), facts)).toEqual(['27', '1.000.000']);
  });
});
