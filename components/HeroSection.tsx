type HeroSectionProps = {
  title?: string;
  subtitle?: string;
};

export default function HeroSection({ title, subtitle }: HeroSectionProps) {
  return (
    <section className="heroSection" id="discovery-intro" tabIndex={-1}>
      <div className="heroBackdrop" aria-hidden="true" />
      <div className="heroLeft">
        <h1 className="heroTitle">
          {title || (
            <>
              Odkrywaj wydarzenia<br />
              w Polsce<span className="heroTitleAccent">.</span>
            </>
          )}
        </h1>
        <p className="heroSubtitle">
          {subtitle || (
          <>
            <span className="heroSubtitleLong">Koncerty, festyny, dożynki, sport i kultura – wszystko w jednej mapie.<br />Znajdź wydarzenia w swojej okolicy i w całej Polsce.</span>
            <span className="heroSubtitleShort">Koncerty, festyny, dożynki, sport i kultura – wszystko w jednym miejscu.</span>
          </>
        )}
        </p>
      </div>
    </section>
  );
}
