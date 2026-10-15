"use client";

/** RED stub: signature only, no device-class behavior yet. */
export function TruncatedText(props: { text: string; className?: string }) {
  return <span className={props.className}>{props.text}</span>;
}
