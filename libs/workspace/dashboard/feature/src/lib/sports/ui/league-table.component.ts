import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { LeagueTable, TableZone } from '../league-tables';
import { isFollowedTeam } from '../my-teams';
import type { SportSection } from '../sport-sections';

const ZONES: readonly TableZone[] = [
    'champions',
    'europe',
    'promotion',
    'playoff',
    'relegation',
];
/** South America's second cup takes the "europe" colour there. */
const SOUTH_AMERICAN = new Set(['liga-argentina', 'libertadores']);

/**
 * A competition's standings beside its matches: position (the podium in
 * amber), crest and team, the last five results (when the source gives
 * them), played and points, a zone bar on the left (Champions, the other
 * continental cups, promotion or direct qualification, playoffs,
 * relegation) with its legend, the followed teams highlighted.
 */
@Component({
    selector: 'lib-league-table',
    imports: [TranslatePipe],
    templateUrl: './league-table.component.html',
    styleUrl: './league-table.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeagueTableComponent {
    readonly table = input.required<LeagueTable>();
    readonly section = input.required<SportSection>();

    /** The form column, when any row has results. */
    readonly hasForm = computed(() =>
        this.table().rows.some((row) => row.form.length > 0)
    );
    /** "Group A" → "Grupo A"; "Eastern Conference" → "Conferencia Este". */
    readonly group = computed(() => {
        const group = this.table().group ?? '';
        const letter = /^group\s+(\w+)$/i.exec(group)?.[1];
        const conference = /^(eastern|western) conference$/i.exec(group)?.[1];
        return letter
            ? { key: 'WORKSPACE.SPORTS.TABLE_GROUP', params: { name: letter } }
            : conference
              ? {
                    key: `WORKSPACE.SPORTS.TABLE_${conference.toUpperCase()}`,
                    params: {},
                }
              : null;
    });

    readonly rows = computed(() =>
        this.table().rows.map((row) => ({
            ...row,
            mine: isFollowedTeam(row.team),
        }))
    );
    /** The zones the rows shown reach, in the legend's order. */
    readonly legend = computed(() => {
        const present = new Set(this.table().rows.map((row) => row.zone));
        return ZONES.filter((zone) => present.has(zone));
    });

    zoneKey(zone: TableZone): string {
        return zone === 'europe' && SOUTH_AMERICAN.has(this.section().id)
            ? 'WORKSPACE.SPORTS.ZONES.SUDAMERICANA'
            : `WORKSPACE.SPORTS.ZONES.${zone.toUpperCase()}`;
    }
}
