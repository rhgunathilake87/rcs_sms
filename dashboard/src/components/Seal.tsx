import { useState } from "react";
import { initials } from "../util";

/** Institution logo, or its initials when no logo is set or it fails to load. */
export function Seal({ name, logoUrl, size = 40 }: { name: string; logoUrl?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: size * 0.38 };

  if (logoUrl && !broken) {
    return <img className="seal" src={logoUrl} alt="" style={style} onError={() => setBroken(true)} />;
  }
  return (
    <span className="seal seal-initials" style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
