"use client";

import { CsvUploader } from "@/components/admin/csv-uploader";

export default function SpendAdmin() {
  return (
    <CsvUploader
      title="Advertiser spend"
      endpoint="/api/admin/spend"
      listKey="spend"
      csvHeaders="advertiser,source_id,period_start,period_end,spend_aud,product"
      placeholder={"advertiser,source_id,period_start,period_end,spend_aud,product\nCarnival,travel-daily,2025-07-01,2026-06-30,48000,display"}
      columns={[
        { field: "advertiser", label: "Advertiser" },
        { field: "source_id", label: "Source" },
        { field: "period_start", label: "From" },
        { field: "period_end", label: "To" },
        { field: "spend_aud", label: "Spend (AUD)" },
        { field: "product", label: "Product" },
      ]}
    />
  );
}
