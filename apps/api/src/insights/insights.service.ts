import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { formatPercent, formatRupiah, type AccessClaims, type Analysis, type Forecast, type Insight } from '@organa/shared';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { periodRange } from '../common/time.js';
import { DB, type Db } from '../db/db.module.js';
import { ts } from '../common/time.js';
import { costLines, insights, orderLines, orders, products } from '../db/schema.js';
import { AnalyticsService } from './analytics.service.js';

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const monthName = (ym: string) => MONTHS_ID[Number(ym.slice(5, 7)) - 1]!;

const sectionsSchema = z.object({
  sections: z
    .array(z.object({ title: z.string(), bullets: z.array(z.string()).min(1).max(5) }))
    .min(2)
    .max(4),
});
type Sections = z.infer<typeof sectionsSchema>['sections'];

/** Facts are computed in code; every number the text may use is pre-formatted here. */
type Facts = Record<string, unknown>;

const SYSTEM_PROMPT = `Kamu adalah analis operasional dapur untuk pemilik usaha F&B di Indonesia.
Tulis ringkasan dan saran dalam Bahasa Indonesia yang singkat, jelas, dan ramah untuk pemilik warung atau kafe.

Aturan angka: gunakan hanya angka, persentase, dan nilai rupiah yang sudah ada di data JSON, persis seperti tertulis.
Jangan menghitung angka baru, jangan membulatkan ulang, dan jangan menebak dampak (misalnya "penjualan naik 27%") yang tidak ada di data.
Jika data kosong atau sedikit, katakan itu dengan jujur.

Buat 3 bagian dengan judul persis: "Unit Terbuang", "Stock Out", "Saran Strategis".
Setiap bagian berisi 1–4 poin, masing-masing satu atau dua kalimat.
Di "Saran Strategis", beri saran konkret: kurangi/tambah pembelian bahan tertentu, promo atau diskon untuk menu yang memakai bahan yang sering terbuang, atau paket bundling.
Jangan menyarankan menambah pembelian bahan yang juga disarankan dikurangi; untuk saran tambah stok, pakai "bahan_sering_habis_lain".`;

@Injectable()
export class InsightsService {
  private readonly logger = new Logger('InsightsService');
  private readonly client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
  ) {}

  async get(claims: AccessClaims, outletId: string, kind: 'analysis' | 'forecast', period: string, regenerate = false): Promise<Insight> {
    if (!regenerate) {
      const cached = await this.db.query.insights.findFirst({
        where: and(eq(insights.outletId, outletId), eq(insights.kind, kind), eq(insights.period, period)),
      });
      if (cached) {
        return { kind, period, sections: cached.sections as Sections, generatedAt: cached.createdAt.toISOString(), source: cached.source as Insight['source'] };
      }
    }
    const facts =
      kind === 'analysis'
        ? await this.analysisFacts(outletId, await this.analytics.analysis(outletId, period))
        : this.forecastFacts(await this.analytics.forecast(claims, outletId, period));
    const { sections, source } = await this.write(facts, kind === 'analysis' ? this.analysisTemplate(facts) : this.forecastTemplate(facts));
    const [row] = await this.db
      .insert(insights)
      .values({ tenantId: claims.tid, outletId, kind, period, facts, sections, source })
      .onConflictDoUpdate({
        target: [insights.outletId, insights.kind, insights.period],
        set: { facts, sections, source, createdAt: sql`now()` },
      })
      .returning();
    return { kind, period, sections, generatedAt: row!.createdAt.toISOString(), source };
  }

  // ---------- facts ----------

  private async analysisFacts(outletId: string, a: Analysis): Promise<Facts> {
    const worst = [...a.months].filter((m) => m.wasteValue > 0).sort((x, y) => y.wasteValue - x.wasteValue).slice(0, 3);
    const top = a.topItems.slice(0, 3);
    const { start, end } = periodRange(a.period);
    const related = top.length ? await this.productsUsing(outletId, top.map((t) => t.ingredientId), start, end) : [];
    const avoidable = top.reduce((s, t) => s + t.value, 0);
    return {
      periode: /^\d{4}$/.test(a.period) ? `tahun ${a.period}` : `${monthName(a.period)} ${a.period.slice(0, 4)}`,
      total_kerugian: formatRupiah(a.totalWasteValue),
      jumlah_kejadian_terbuang: a.totalWasteEvents,
      bulan_terburuk: worst.map((m) => ({ bulan: monthName(m.month), kerugian: formatRupiah(m.wasteValue) })),
      bahan_terbuang_teratas: top.map((t) => ({
        nama: t.name, porsi_kerugian: formatPercent(t.share, 0), kerugian: formatRupiah(t.value), jumlah: `${t.qty} ${t.baseUnit}`,
      })),
      kerugian_bisa_dihindari_jika_pembelian_bahan_teratas_disesuaikan: formatRupiah(avoidable),
      bahan_sering_habis: a.stockouts.slice(0, 3).map((s) => ({ nama: s.name, kali_habis: s.count })),
      bahan_sering_habis_lain: a.stockouts
        .filter((s) => !top.some((t) => t.ingredientId === s.ingredientId))
        .slice(0, 3)
        .map((s) => ({ nama: s.name, kali_habis: s.count })),
      menu_yang_memakai_bahan_terbuang: related.map((r) => ({ menu: r.product, bahan: r.ingredient, terjual: r.sold })),
    };
  }

  private forecastFacts(f: Forecast): Facts {
    return {
      bulan_prediksi: `${monthName(f.month)} ${f.month.slice(0, 4)}`,
      metode: f.method,
      prediksi_kerugian: formatRupiah(f.predictedWasteValue),
      prediksi_kejadian_terbuang: f.predictedWasteEvents,
      bahan_diprediksi_terbuang: f.items.slice(0, 3).map((i) => ({
        nama: i.name, porsi: formatPercent(i.share, 0), kerugian: formatRupiah(i.value), jumlah: `${i.qty} ${i.baseUnit}`,
      })),
      sebaiknya_tambah_pembelian: f.buyMore.map((b) => ({ nama: b.name, alasan: b.reason })),
      sebaiknya_kurangi_pembelian: f.buyLess.map((b) => ({ nama: b.name, alasan: b.reason })),
    };
  }

  /** Products whose recipe uses the given ingredients, with units sold in the period. */
  private async productsUsing(outletId: string, ingredientIds: string[], start: Date, end: Date) {
    const rows = await this.db.execute<{ product: string; ingredient: string; sold: number }>(sql`
      select p.name as product, cl.label as ingredient,
        coalesce((select sum(ol.qty) from ${orderLines} ol join ${orders} o on o.id = ol.order_id
                  where ol.product_id = p.id and o.outlet_id = ${outletId} and o.created_at >= ${ts(start)} and o.created_at < ${ts(end)}), 0)::int as sold
      from ${costLines} cl join ${products} p on p.id = cl.product_id
      where cl.ingredient_id in ${ingredientIds} and p.active
      order by sold asc limit 3`);
    return rows.map((r) => ({ ...r, sold: Number(r.sold) }));
  }

  // ---------- writing ----------

  /** Claude writes the text when configured and its output only uses numbers from the facts; else the template. */
  private async write(facts: Facts, template: Sections): Promise<{ sections: Sections; source: Insight['source'] }> {
    if (!this.client) return { sections: template, source: 'template' };
    try {
      const response = await this.client.beta.messages.parse({
        model: 'claude-opus-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: zodOutputFormat(sectionsSchema) },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Data (JSON):\n${JSON.stringify(facts, null, 2)}` }],
      });
      if (response.stop_reason === 'refusal' || !response.parsed_output) {
        this.logger.warn(`Claude returned no usable output (${response.stop_reason}); using template`);
        return { sections: template, source: 'template' };
      }
      const sections = response.parsed_output.sections;
      const unknown = unknownNumbers(sections, facts);
      if (unknown.length) {
        this.logger.warn(`Claude used numbers not in the facts (${unknown.join(', ')}); using template`);
        return { sections: template, source: 'template' };
      }
      return { sections, source: 'claude' };
    } catch (e) {
      if (e instanceof Anthropic.APIError) this.logger.warn(`Claude API error ${e.status}: ${e.message}; using template`);
      else this.logger.warn(`Insight generation failed: ${String(e)}; using template`);
      return { sections: template, source: 'template' };
    }
  }

  private analysisTemplate(f: Facts): Sections {
    const top = f.bahan_terbuang_teratas as { nama: string; porsi_kerugian: string; kerugian: string }[];
    const worst = f.bulan_terburuk as { bulan: string }[];
    const outs = f.bahan_sering_habis as { nama: string; kali_habis: number }[];
    const related = f.menu_yang_memakai_bahan_terbuang as { menu: string; bahan: string }[];
    const restock = (f.bahan_sering_habis_lain as { nama: string }[] | undefined) ?? [];
    if (!top.length) {
      return [
        { title: 'Unit Terbuang', bullets: [`Belum ada bahan yang terbuang pada ${f.periode}.`] },
        { title: 'Stock Out', bullets: outs.length ? outs.map((o) => `${o.nama} habis ${o.kali_habis}x.`) : ['Tidak ada bahan yang habis.'] },
        { title: 'Saran Strategis', bullets: ['Lanjutkan pencatatan stok masuk dan stok opname agar analisis makin akurat.'] },
      ];
    }
    return [
      {
        title: 'Unit Terbuang',
        bullets: [
          `Pada ${f.periode} terjadi ${f.jumlah_kejadian_terbuang} kejadian bahan terbuang dengan total kerugian ${f.total_kerugian}.`,
          ...(worst.length ? [`Kerugian terbesar terjadi pada bulan ${worst.map((w) => w.bulan).join(', ')}.`] : []),
          `Penyumbang terbesar: ${top.map((t) => `${t.nama} (${t.porsi_kerugian}, ${t.kerugian})`).join(', ')}.`,
        ],
      },
      {
        title: 'Stock Out',
        bullets: outs.length ? outs.map((o) => `${o.nama} habis ${o.kali_habis}x pada periode ini.`) : ['Tidak ada bahan yang sampai habis.'],
      },
      {
        title: 'Saran Strategis',
        bullets: [
          `Kurangi jumlah pembelian ${top.map((t) => t.nama).join(', ')}; kerugian ${f.kerugian_bisa_dihindari_jika_pembelian_bahan_teratas_disesuaikan} bisa dihindari jika pembelian disesuaikan dengan pemakaian.`,
          ...related.slice(0, 1).map((r) => `Pertimbangkan promo atau paket bundling untuk ${r.menu} agar ${r.bahan} lebih cepat terpakai.`),
          // Items already told to "buy less" are not also told to "buy more".
          ...(restock.length ? [`Tambah stok ${restock.map((o) => o.nama).join(', ')} untuk menghindari kehabisan.`] : []),
        ],
      },
    ];
  }

  private forecastTemplate(f: Facts): Sections {
    const items = f.bahan_diprediksi_terbuang as { nama: string; porsi: string }[];
    const more = f.sebaiknya_tambah_pembelian as { nama: string; alasan: string }[];
    const less = f.sebaiknya_kurangi_pembelian as { nama: string }[];
    return [
      {
        title: 'Unit Terbuang',
        bullets: items.length
          ? [
              `Diprediksi ${f.prediksi_kejadian_terbuang} kejadian bahan terbuang dengan kerugian ${f.prediksi_kerugian} pada ${f.bulan_prediksi}.`,
              `Paling berisiko: ${items.map((i) => `${i.nama} (${i.porsi})`).join(', ')}.`,
            ]
          : [`Belum cukup data untuk memprediksi limbah pada ${f.bulan_prediksi}.`],
      },
      {
        title: 'Stock Out',
        bullets: more.length ? more.map((m) => `${m.nama}: ${m.alasan}. Pertimbangkan menambah pembelian.`) : ['Tidak ada bahan yang diprediksi habis.'],
      },
      {
        title: 'Saran Strategis',
        bullets: [
          ...(less.length ? [`Kurangi pembelian ${less.map((l) => l.nama).join(', ')} pada ${f.bulan_prediksi}.`] : []),
          ...(more.length ? [`Tambah pembelian ${more.map((m) => m.nama).join(', ')}.`] : []),
          `Prediksi memakai ${String(f.metode).toLowerCase()}.`,
        ],
      },
    ];
  }
}

/** Numbers in the text that do not appear anywhere in the facts (ignoring thousand separators). */
export function unknownNumbers(sections: Sections, facts: Facts): string[] {
  const norm = (s: string) => s.replace(/\./g, '').replace(',', '.');
  const allowed = new Set((JSON.stringify(facts).match(/\d[\d.,]*/g) ?? []).map((n) => norm(n.replace(/[.,]$/, ''))));
  const used = sections.flatMap((s) => s.bullets.join(' ').match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/[.,]$/, ''));
  return used.filter((n) => !allowed.has(norm(n)) && !/^(19|20)\d{2}$/.test(n));
}
