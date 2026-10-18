import { Institution } from "../session";
import { Seal } from "./Seal";

/** Shows the customer's view: the verified header the Android app adds above the SMS. */
export function PhonePreview({ institution, message }: { institution: Institution; message: string }) {
  const text = message.trim();
  return (
    <figure className="phone" aria-label="Preview of the message on the customer's phone">
      <div className="phone-screen">
        <div className="phone-from">From {institution.senderId || "your sender ID"}</div>
        <div className="bubble">
          <div className="bubble-head">
            <Seal name={institution.name} logoUrl={institution.logoUrl} size={30} />
            <div>
              <div className="bubble-name">{institution.name}</div>
              <div className="bubble-verified">
                <span aria-hidden="true">✓</span> Verified sender
              </div>
            </div>
          </div>
          <p className={text ? "bubble-text" : "bubble-text bubble-empty"}>
            {text || "Your message will appear here."}
          </p>
        </div>
      </div>
      <figcaption>
        What the customer sees when the registry confirms the message. A changed or spoofed copy shows a
        phishing warning instead.
      </figcaption>
    </figure>
  );
}
