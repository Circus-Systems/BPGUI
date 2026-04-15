import Link from "next/link";

const CARDS = [
  { href: "/admin/journalists", title: "Journalists", desc: "Editorial team roster per publication. Populates deck slides 2 and 7." },
  { href: "/admin/events", title: "Events attended", desc: "BPG journalists at events tagged to an advertiser." },
  { href: "/admin/spend", title: "Advertiser spend", desc: "Commercial spend data per advertiser / publication / period — drives the spend-vs-coverage scatter." },
  { href: "/admin/survey", title: "Reader survey", desc: "Authority and respect scores used in the deck's reader authority slide." },
  { href: "/admin/ave-rates", title: "AVE rate card", desc: "Dollar rates per publication × metric. Drives the deck's AVE total." },
];

export default function AdminOverview() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {CARDS.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="block rounded-lg border border-border bg-white p-5 hover:border-accent hover:shadow-sm transition"
        >
          <p className="text-sm font-semibold text-foreground">{c.title}</p>
          <p className="text-xs text-muted mt-2 leading-relaxed">{c.desc}</p>
        </Link>
      ))}
    </div>
  );
}
