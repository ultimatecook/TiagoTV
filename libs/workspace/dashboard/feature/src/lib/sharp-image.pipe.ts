import { Pipe, type PipeTransform } from '@angular/core';
import {
    sharpImageUrl,
    type SharpImageKind,
} from '@iptvnator/shared/interfaces';

/**
 * `[src]="poster | sharpImage: 'poster' : 260"`: a TMDB title image at a
 * size that stays sharp at that CSS width on this screen (`sharpImageUrl`);
 * any other URL as it is. Failure bookkeeping keeps using the raw URL.
 */
@Pipe({ name: 'sharpImage' })
export class SharpImagePipe implements PipeTransform {
    transform(
        url: string | null | undefined,
        kind: SharpImageKind,
        cssWidth: number
    ): string | null {
        return url ? sharpImageUrl(url, kind, cssWidth) : null;
    }
}
