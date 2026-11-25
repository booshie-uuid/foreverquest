export const BLOCKS =
{
    grass: { faces: { top: "grass", side: "grassSide", bottom: "earth" } },
    moss: { faces: { top: "moss", side: "mossSide", bottom: "earth" } },
    earth: { faces: { all: "earth" } },
    mud: { faces: { top: "mud", side: "earth", bottom: "earth" } },
    sand: { faces: { all: "sand" } },
    cobble: { faces: { top: "cobble", side: "rubble", bottom: "earth" } },
    rock: { faces: { all: "crag" }, weathers: ["moss", "grime", "cracks", "chips"] },
    water: { faces: { all: "water" }, kind: "liquid" },
};
