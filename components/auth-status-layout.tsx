import Link from "next/link";
import AuthBrandPanel from "@/components/auth-brand-panel";

type Props = {
  kicker: string;
  title: string;
  description: string;
  buttonLabel: string;
  buttonHref: string;
  footnote: string;
};

export default function AuthStatusLayout({ kicker, title, description, buttonLabel, buttonHref, footnote }: Props) {
  return (
    <main className="auth-page auth-status-page">
      <div className="auth-glow auth-glow-one" aria-hidden="true" />
      <div className="auth-glow auth-glow-two" aria-hidden="true" />
      <section className="auth-layout auth-status-layout" aria-label="Estado de la cuenta">
        <AuthBrandPanel variant="status" />
        <div className="auth-form-column">
          <section className="auth-card auth-success-card" aria-labelledby="auth-status-title">
            <div className="auth-card-head">
              <div>
                <span className="auth-card-kicker">{kicker}</span>
                <h2 id="auth-status-title">{title}</h2>
                <p>{description}</p>
              </div>
              <span className="auth-secure" aria-hidden="true">✓</span>
            </div>
            <div className="auth-success-mark" aria-hidden="true">✓</div>
            <Link className="btn btn-primary auth-success-button" href={buttonHref}>{buttonLabel}</Link>
          </section>
          <p className="auth-foot">{footnote}</p>
        </div>
      </section>
    </main>
  );
}
