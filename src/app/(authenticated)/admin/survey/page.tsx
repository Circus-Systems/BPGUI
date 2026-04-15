"use client";

import { CsvUploader } from "@/components/admin/csv-uploader";

export default function SurveyAdmin() {
  return (
    <CsvUploader
      title="Reader survey results"
      endpoint="/api/admin/survey"
      listKey="results"
      csvHeaders="survey_name,survey_date,question,publication,metric,score,sample_size"
      placeholder={"survey_name,survey_date,question,publication,metric,score,sample_size\nBPG Reader 2026,2026-03-01,Most respected travel title,Travel Daily,respected,72,850"}
      columns={[
        { field: "survey_date", label: "Date" },
        { field: "survey_name", label: "Survey" },
        { field: "publication", label: "Publication" },
        { field: "metric", label: "Metric" },
        { field: "score", label: "Score" },
        { field: "sample_size", label: "n" },
      ]}
    />
  );
}
