export default function Loading() {
  return (
    <main className="homePage loadingHomePage" aria-busy="true" aria-label="Ladowanie wydarzen">
      <section className="loadingHero">
        <div className="loadingBlock loadingTitle" />
        <div className="loadingBlock loadingSubtitle" />
        <div className="loadingHeroTiles">
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="loadingSearchPanel">
        <div className="loadingSearchGrid">
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>

      <div className="loadingMainLayout">
        <section className="loadingEventsList">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="loadingEventRow">
              <span />
              <div>
                <b />
                <i />
                <em />
              </div>
            </div>
          ))}
        </section>

        <aside className="loadingSidebar">
          <div />
          <div />
          <div />
        </aside>
      </div>
    </main>
  );
}
