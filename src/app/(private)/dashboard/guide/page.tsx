import { Radio, Link2, Smartphone, RefreshCw, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import { requirePageAdmin } from "@/lib/auth";
export default async function GuidePage() {
  await requirePageAdmin();
  const steps = [
    {
      icon: Link2,
      title: "Create your connection",
      description:
        "Add a tag in your dashboard. Give it a name and a public HTTPS destination, then copy the permanent NFC URL. Copy the NFC URL, rather than the destination.",
    },
    {
      icon: Smartphone,
      title: "Write it to your sticker",
      description:
        "On your iPhone, open a third-party NFC writer such as NFC Tools. Choose Write → Add a record → URL / URI. Paste your NFC URL, confirm it, choose Write, and hold the top of your phone near a compatible blank NDEF sticker.",
    },
    {
      icon: Radio,
      title: "Give it a tap",
      description:
        "Close the writer, unlock your iPhone, and hold its top near the sticker. Tap the notification to open the link. You can also scan the QR code in the dashboard to test the same URL.",
    },
    {
      icon: RefreshCw,
      title: "Let your destination evolve",
      description:
        "Edit the tag’s destination in your dashboard and save. The same sticker will take its next visitor to the updated destination. Disable the tag whenever you need a pause.",
    },
  ];
  return (
    <div className="max-w-4xl">
      <p className="eyebrow mb-3">FROM SCREEN TO STICKER</p>
      <h1 className="text-[34px] font-semibold tracking-tight">A small guide to a simple tap.</h1>
      <p className="mt-3 mb-10 max-w-xl text-sm leading-7 text-muted-foreground">
        You only need to write your sticker once. After that, everything happens right here in your
        workspace.
      </p>
      <div className="space-y-4">
        {steps.map(({ icon: Icon, title, description }, i) => (
          <section key={title} className="flex gap-5 rounded-xl border bg-card p-6 sm:gap-6 sm:p-8">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
              <Icon size={22} strokeWidth={1.6} />
            </span>
            <div>
              <p className="eyebrow mb-2">STEP 0{i + 1}</p>
              <h2 className="text-lg font-medium tracking-tight">{title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                {description}
              </p>
            </div>
          </section>
        ))}
      </div>
      <div className="mt-6 rounded-xl border bg-secondary/60 p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck size={18} /> A few things to keep in mind
        </h2>
        <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
          <li>
            Use a compatible, rewritable NDEF sticker. Your phone and writer determine hardware
            support; this web app does not write directly to NFC.
          </li>
          <li>
            Keep your app’s public domain stable. Stickers store that full URL, so moving the app to
            a new domain requires keeping the original domain working.
          </li>
          <li>
            A random NFC URL is public, and visitors can see the destination. Protect sensitive
            documents with the destination service’s own sign-in.
          </li>
          <li>
            A destination can redirect elsewhere or change its DNS later. Only use links and domains
            you trust.
          </li>
          <li>
            Test the sticker before placing it. Metal surfaces may require an anti-metal NFC
            sticker.
          </li>
        </ul>
      </div>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary"
      >
        Make your first connection <ArrowRight size={16} />
      </Link>
    </div>
  );
}
