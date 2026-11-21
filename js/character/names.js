const SYLLABLES =
{
    human: { start: ["Al", "Bren", "Cor", "Ed", "Gar", "Hal", "Ma", "Ro", "Wil", "Ty"], end: ["dric", "an", "wyn", "ric", "ton", "da", "ra", "bert", "en", "ys"] },
    elf: { start: ["Ae", "Ca", "Ela", "Ily", "Lae", "Syl", "Tha", "Vae", "Ner", "Fae"], end: ["rion", "lith", "ra", "wen", "dril", "nor", "riel", "thas", "lyn", "sar"] },
    dwarf: { start: ["Bro", "Dur", "Gim", "Tho", "Bal", "Kor", "Har", "Dag", "Mor", "Gun"], end: ["m", "in", "rak", "gar", "din", "grim", "nar", "dal", "rik", "li"] },
    halfling: { start: ["Pip", "Mer", "Ro", "Fen", "Tob", "Daisy", "Mil", "Lob", "Bil", "Pod"], end: ["kin", "ry", "wick", "o", "by", "bell", "ble", "do", "lo", "ny"] },
    orc: { start: ["Gru", "Mog", "Ur", "Za", "Kro", "Thu", "Gor", "Bru", "Ra", "Sha"], end: ["kk", "gash", "zug", "rak", "mok", "rg", "ta", "gul", "nak", "z"] },
};

export function generate(random, race)
{
    const table = SYLLABLES[race] ?? SYLLABLES.human;

    return random.pick(table.start) + random.pick(table.end);
}
