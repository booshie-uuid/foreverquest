/******************************************************************************/
/* CONSTRUCT LOOK                                                             */
/******************************************************************************/

// A construct wears nothing and never changes.
export class ConstructLook
{
    constructor(library, id)
    {
        this.library = library;
        this.id = id;
        this.construct = library.construct(id);
    }

    get body()
    {
        return this.construct.body;
    }

    get(field)
    {
        return field === "name" ? this.construct.name : null;
    }

    equipped()
    {
        return null;
    }
}
