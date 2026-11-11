import { useState, type ReactNode } from "react";
import { CheckCircle2, ExternalLink, Loader2, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import mascot from "@/assets/login-mascot.png";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { walletLogin, type XrplQrPrompt } from "@/lib/chains/providers";
import { useAuthStore } from "@/features/stores/auth.store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** XRPL sign-in via Xaman: QR code on desktop, deep link on mobile. */
export function ConnectWalletModal({ children }: { children: ReactNode }) {
  const setSession = useAuthStore((s) => s.setSession);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<XrplQrPrompt | null>(null);
  const [scanned, setScanned] = useState(false);

  const start = async () => {
    setBusy(true);
    setError(null);
    setPrompt(null);
    setScanned(false);
    try {
      const { player, token } = await walletLogin("xrpl", {
        xrplWallet: "xaman",
        onPrompt: setPrompt,
        onStatus: (status) => {
          if (status.status === "scanned") setScanned(true);
        },
      });
      setSession(player, token);
      setOpen(false);
      if (pathname === "/") navigate({ to: "/play" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
      setPrompt(null);
      setScanned(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className={`cw-modal${prompt ? " cw-modal-qr" : ""}`} scrollBody={false}>
        <div className="cw-art">
          <img src="/brand/game-logo.png" alt="Vexaria" className="cw-sign" />
          <img src={mascot} alt="" aria-hidden="true" width={1088} height={608} className="cw-mascot" />
          <span className="cw-art-caption">YOUR NEXT ADVENTURE AWAITS</span>
        </div>
        <div className="cw-body">
          <DialogHeader>
            <span className="hud-window-eyebrow">WELCOME, ADVENTURER</span>
            <DialogTitle className="cw-title">
              {prompt ? <>One scan.<br /><span>You're almost in.</span></> : <>Your crew.<br /><span>Your adventure.</span></>}
            </DialogTitle>
            <DialogDescription className="cw-desc">
              {prompt ? "Open Xaman, scan the code and approve your sign-in." : "Sign in with your XRPL wallet to enter the mines and build your bomber crew."}
            </DialogDescription>
          </DialogHeader>

          {prompt ? (
            <>
              <div className="cw-qr">
                {prompt.qrImage && (
                  <img src={prompt.qrImage} alt="Xaman sign-in QR code" style={{ opacity: scanned ? 0.2 : 1 }} />
                )}
                {scanned && (
                  <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                    <CheckCircle2 className="size-16 text-success" />
                  </div>
                )}
              </div>
              <div role="status" aria-live="polite" className="cw-status">
                {scanned ? (
                  <>
                    <strong>Scanned!</strong>
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Please review and confirm the sign-in on your phone.
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Scan with Xaman and approve the sign-in
                  </span>
                )}
              </div>
              <a href={prompt.deeplink} className="cw-link">
                <Smartphone className="size-4" /> Open Xaman on this phone
              </a>
            </>
          ) : (
            <>
              <div className="cw-provider">
                <span className="cw-provider-icon"><Smartphone /></span>
                <div><strong>Xaman</strong><span>Your wallet on the XRP Ledger</span></div>
                <span className="cw-provider-badge">XRPL</span>
              </div>
              <button type="button" className="cw-btn" disabled={busy} onClick={start}>
                {busy ? <Loader2 className="animate-spin" /> : <QrCode />}
                {busy ? "Preparing QR…" : "Connect with Xaman"}
              </button>
            </>
          )}

          {error && <p role="alert" className="cw-error">{error}</p>}
          <a href="https://xaman.app" target="_blank" rel="noreferrer" className="cw-link">
            What is Xaman? <ExternalLink className="size-4" />
          </a>
          <div className="cw-foot">
            <ShieldCheck /> <span>Your keys stay in Xaman.<br />Only a sign-in approval is requested.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
