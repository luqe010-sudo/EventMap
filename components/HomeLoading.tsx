export default function Loading() {
  return (
    <main className="homePage loadingHomePage" aria-busy="true" aria-label="Ładowanie wydarzeń">
      <section className="loadingHero">
        <div>
          <div className="loadingBlock loadingTitle" />
          <div className="loadingBlock loadingSubtitle" />
        </div>
      </section>

      <section className="loadingSearchPanel" aria-hidden="true">
        <div className="loadingQuickFilters">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>
        <div className="loadingSearchGrid">
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>

      <div className="loadingMainLayout">
        <section className="loadingFeatured" aria-hidden="true">
          <div className="loadingBlock loadingShelfHeading" />
          <div className="loadingFeaturedGrid">
            {Array.from({ length: 3 }, (_, index) => <div className="loadingBlock loadingFeaturedCard" key={index} />)}
          </div>
        </section>

        <aside className="loadingSidebar">
          <div />
        </aside>
      </div>
    </main>
  );
}
