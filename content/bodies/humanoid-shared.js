// Box changes in texels. The legs must keep half the torso's width and all of
// its depth.
export const FEMALE = { id: "female", name: "Female", boxes: { torso: [-2, -2, -1], arm: [-1, 0, -1], leg: [-1, 0, -1] } };

export const MALE = { id: "male", name: "Male", boxes: {} };

export const SLIDERS =
{
    build: { steps: 2, boxes: { torso: [2, 0, 1], arm: [1, 0, 1], leg: [1, 0, 1] } },
    height: { scale: 0.06 },
};

export const MEASURES = { radius: 0.35, walk: 2.4, run: 5.2, nameplate: 0.32, focus: 1.4 };
