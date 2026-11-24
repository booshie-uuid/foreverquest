// Positions are fine cubes, 8 to a world cube's edge, from the object's lower
// corner: x along its length, y up and z across. These objects move, so a
// zone gives each placement a mover track or a trigger.

export const OBJECTS =
{
    lockedDoor:
    {
        cells: [3, 7, 1],
        build(door)
        {
            door.box([0, 0, 2], [24, 56, 6], "oldPlanks");

            for(let x = 0; x < 24; x += 6) { door.box([x, 0, 1], [x + 1, 56, 7], "timber"); }
            for(const y of [10, 44]) { door.box([1, y, 1], [23, y + 2, 7], "iron"); }

            door.box([17, 26, 0], [19, 30, 8], "iron");
            door.box([18, 23, 1], [19, 25, 7], "iron");
        },
    },
    portcullis:
    {
        cells: [4, 7, 1],
        build(gate)
        {
            for(const x of [3, 9, 15, 21, 27])
            {
                gate.box([x, 2, 3], [x + 2, 56, 5], "timber");
                gate.box([x, 0, 3], [x + 2, 2, 5], "iron");
            }

            for(const y of [10, 26, 42, 52]) { gate.box([1, y, 2], [31, y + 2, 6], "iron"); }
        },
    },
    leverBase:
    {
        cells: [1, 1, 1],
        build(base)
        {
            base.box([0, 0, 0], [8, 6, 8], "stone");
            base.box([1, 6, 1], [7, 8, 7], "iron");
        },
    },
    leverHandle:
    {
        cells: [1, 2, 1],
        isSolid: false,
        build(handle)
        {
            handle.box([3, 0, 3], [5, 12, 5], "iron");
            handle.box([2, 12, 2], [6, 15, 6], "timber");
        },
    },
    liftPlatform:
    {
        cells: [3, 1, 3],
        build(lift)
        {
            lift.box([0, 0, 0], [24, 3, 24], "iron");
            lift.box([1, 3, 1], [23, 8, 23], "planks");

            for(const x of [0, 21]) { lift.box([x, 3, 0], [x + 3, 8, 24], "iron"); }
        },
    },
    millWheel:
    {
        cells: [2, 8, 8],
        build(wheel)
        {
            const centre = 32;

            for(let y = 0; y < 64; y++)
            {
                for(let z = 0; z < 64; z++)
                {
                    const dy = y + 0.5 - centre;
                    const dz = z + 0.5 - centre;
                    const distance = Math.hypot(dy, dz);
                    const sector = (Math.atan2(dy, dz) + Math.PI * 2) % (Math.PI / 4);
                    const offLine = Math.sin(Math.min(sector, Math.PI / 4 - sector)) * distance;
                    const isSpoke = distance < 26 && offLine < 1.3;
                    const isPaddle = distance >= 26 && distance < 31.5 && offLine < 1.2;

                    if(distance >= 23 && distance < 26) { wheel.box([4, y, z], [12, y + 1, z + 1], "timber"); }
                    if(isSpoke) { wheel.box([6, y, z], [10, y + 1, z + 1], "timber"); }
                    if(isPaddle) { wheel.box([2, y, z], [14, y + 1, z + 1], "planks"); }
                    if(distance < 4) { wheel.box([0, y, z], [16, y + 1, z + 1], "iron"); }
                }
            }
        },
    },
};
