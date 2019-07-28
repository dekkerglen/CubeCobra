declare module 'truncate' {
    interface TruncateOptions {
        ellipsis?: string
    }

    export default function truncate(string: string, maxLength: number, options?: TruncateOptions): string
}
