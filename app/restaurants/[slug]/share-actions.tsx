"use client";

import { useState } from "react";

type ShareActionsProps = {
  title: string;
  url: string;
};

export function ShareActions({ title, url }: ShareActionsProps) {
  const [copied, setCopied] = useState(false);
  const shareText = `${title} - HalalSofra`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <a className="button" href={whatsappUrl} target="_blank" rel="noreferrer">
        Paylaş
      </a>
      <button className="button" type="button" onClick={copyLink}>
        {copied ? "Link kopyalandı" : "Linki Kopyala"}
      </button>
    </>
  );
}
