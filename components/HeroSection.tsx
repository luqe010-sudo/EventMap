type HeroSectionProps = {
  title?: string;
  subtitle?: string;
  accentTitle?: boolean;
};

export default function HeroSection({ title, subtitle, accentTitle }: HeroSectionProps) {
  return (
    <section className="heroSection" id="discovery-intro" tabIndex={-1}>
      <div className="heroBackdrop" aria-hidden="true" />
      <div className="heroLeft">
        <h1 className="heroTitle">
          {title ? <>{title}{accentTitle ? <span className="heroTitleAccent">.</span> : null}</> : (
            <>
              Odkrywaj wydarzenia<br />
              w Polsce<span className="heroTitleAccent">.</span>
            </>
          )}
        </h1>
        <p className="heroSubtitle">
          {subtitle || (
          <>
            <span className="heroSubtitleLong">Koncerty, festyny, dożynki, sport i kultura – wszystko w jednej mapie.<br />Znajdź ciekawe wydarzenia w Twojej okolicy i w całej Polsce.</span>
            <span className="heroSubtitleShort">Koncerty, festyny, dożynki, sport i kultura – wszystko w jednym miejscu.</span>
          </>
        )}
        </p>
      </div>
    </section>
  );
}
