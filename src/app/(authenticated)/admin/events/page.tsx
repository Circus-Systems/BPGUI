"use client";

import { CsvUploader } from "@/components/admin/csv-uploader";

export default function EventsAdmin() {
  return (
    <CsvUploader
      title="Events attended"
      endpoint="/api/admin/events"
      listKey="events"
      csvHeaders="source_id,event_name,event_date,advertiser,attended_by,notes"
      placeholder={"source_id,event_name,event_date,advertiser,attended_by\ntravel-daily,Cruise360 Australia,2026-02-14,Carnival,Bruce Piper"}
      columns={[
        { field: "event_date", label: "Date" },
        { field: "event_name", label: "Event" },
        { field: "source_id", label: "Source" },
        { field: "advertiser", label: "Advertiser" },
        { field: "attended_by", label: "Attended by" },
      ]}
    />
  );
}
