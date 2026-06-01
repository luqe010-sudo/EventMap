"use client";

type PopularNearbyProps = {
  cities: Array<{ city: string; count: number }>;
};

export default function PopularNearby({ cities }: PopularNearbyProps) {
  if (cities.length === 0) return null;

  return (
    <section className="popularSection">
      <div className="popularHeader">
        <h2 className="popularTitle">Popularne w okolicy</h2>
        <p className="popularSubtitle">Odkryj wydarzenia w pobliskich miastach</p>
      </div>
      <div className="popularGrid">
        {cities.slice(0, 8).map(({ city, count }) => (
          <div key={city} className="popularTile">
            <div className="popularTileContent">
              <span className="popularTileIcon">📍</span>
              <div className="popularTileInfo">
                <span className="popularTileName">{city}</span>
                <span className="popularTileCount">
                  {count} {count === 1 ? "wydarzenie" : count < 5 ? "wydarzenia" : "wydarzeń"}
                </span>
              </div>
            </div>
            <svg className="popularTileArrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        ))}
      </div>
    </section>
  );
}
