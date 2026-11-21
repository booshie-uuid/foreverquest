export class Log
{
    static info(...parts)
    {
        console.info(...parts);
    }

    static warn(...parts)
    {
        console.warn(...parts);
    }

    static error(...parts)
    {
        console.error(...parts);
    }
}
