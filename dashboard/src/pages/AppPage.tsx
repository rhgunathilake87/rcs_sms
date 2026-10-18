import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { API_BASE, APK_URL } from "../firebase";
import { directDownloadUrl } from "../util";

export function AppPage() {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const downloadUrl = APK_URL ? directDownloadUrl(APK_URL) : "";

  useEffect(() => {
    if (!downloadUrl) return;
    QRCode.toDataURL(downloadUrl, { margin: 1, width: 440, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(""));
  }, [downloadUrl]);

  async function copyUrl() {
    await navigator.clipboard.writeText(API_BASE);
    setCopied(true);
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>Get the Android app</h1>
        <p>
          The app checks every incoming SMS against the registry and shows whether it really came from the bank.
        </p>
      </header>

      <div className="app-grid">
        <ol className="steps">
          <li>
            <h2>Download and install</h2>
            <p>
              Scan the code with your Android phone, or tap <strong>Download APK</strong> on the phone itself. When
              Android asks, allow installing apps from this source.
            </p>
          </li>
          <li>
            <h2>Enter your own number</h2>
            <p>
              Open the app, go to <strong>Settings</strong>, enter the number of the phone the app is installed on,
              and save. If the backend URL field isn't already filled in, use{" "}
              <button type="button" className="link-btn mono" onClick={copyUrl} title="Copy URL">
                {API_BASE}
              </button>
              {copied && <span className="muted"> (copied)</span>}.
            </p>
          </li>
          <li>
            <h2>Allow SMS access</h2>
            <p>
              On the <strong>Inbox</strong> tab, tap <strong>Grant permission</strong> so the app can check messages
              as they arrive.
            </p>
          </li>
          <li>
            <h2>Send yourself a verified message</h2>
            <p>
              On the <strong>Send message</strong> page, send a message to your number. When that exact text reaches
              your phone it shows a green <strong>Verified</strong> header. Change one character and it shows a red
              phishing warning instead.
            </p>
          </li>
        </ol>

        <div className="download-card">
          {downloadUrl ? (
            <>
              {qr ? (
                <img className="qr" src={qr} alt="QR code to download the Android app" />
              ) : (
                <div className="qr qr-empty muted">Generating code…</div>
              )}
              <p className="muted small">Scan with your phone's camera</p>
              <a className="btn btn-primary btn-block" href={downloadUrl} target="_blank" rel="noopener noreferrer">
                Download APK
              </a>
              <a className="link-btn" href={APK_URL} target="_blank" rel="noopener noreferrer">
                Open in Google Drive
              </a>
            </>
          ) : (
            <p className="muted">
              The download link hasn't been set yet. Add <code>VITE_APK_URL</code> to the dashboard's environment file
              and redeploy.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
