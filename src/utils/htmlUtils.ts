export const extractAndCleanHtml = (html: string, contentClass?: string): string => {
    if (!html) return '';

    let clean = html.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');

    // Remove legacy practicepaper images and internal wp-content uploads
    clean = clean.replace(/<img[^>]+src=["'][^"']*practicepaper[^"']*["'][^>]*>/gi, '');
    clean = clean.replace(/<img[^>]+src=["'][^"']*wp-content[^"']*["'][^>]*>/gi, '');
    clean = clean.replace(/<img[^>]+src=["']http:\/\/www\.practicepaper\.in[^"']*["'][^>]*>/gi, '');

    // Fix lazy loaded images (data-src -> src)
    clean = clean.replace(
        /(<img[^>]*?data-src=(["']))(.*?)\2([^>]*?src=(["']))(.*?)\5/gi,
        (_match, part1, quote, dataSrcValue, part2, _part3, _oldSrcValue) => {
            return `${part1}${dataSrcValue}${quote}${part2}${dataSrcValue}${quote}`;
        }
    );

    // Remove lazyload class
    clean = clean.replace(/class=(["'])(.*?)(lazyload)(.*?)(\1)/gi, (_match, quote, before, _lazyload, after) => {
        const newClasses = (before + after).trim().replace(/\s{2,}/g, ' ');
        if (newClasses) {
            return `class=${quote}${newClasses}${quote}`;
        }
        return '';
    });

    if (contentClass) {
        const regex = new RegExp(`<div[^>]*class=["'][^"']*${contentClass}[^"']*["'][^>]*>([\\s\\S]*?)<\/div>`, 'i');
        const match = clean.match(regex);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    return clean.trim();
};
