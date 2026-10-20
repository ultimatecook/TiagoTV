import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    linkedSignal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type {
    LeagueTable,
    LeagueTableGroup,
    TableZone,
} from '../league-tables';
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
 * relegation) with its legend, the followed teams highlighted. A table
 * in groups (Liga Profesional's zones, the Libertadores' groups) opens on
 * the followed team's group, with a switch to the others.
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

    /** The groups to switch between; empty for a single table. */
    readonly groups = computed(() =>
        (this.table().groups ?? []).map((group, index) => ({
            index,
            label: groupLabel(group.name),
            short: shortName(group.name),
        }))
    );
    /** The group shown: the table's own (a followed team's) until picked. */
    readonly selected = linkedSignal(() => {
        const { groups, group } = this.table();
        return Math.max(
            0,
            (groups ?? []).findIndex((entry) => entry.name === group)
        );
    });
    readonly shown = computed<LeagueTableGroup>(() => {
        const table = this.table();
        return (
            table.groups?.[this.selected()] ?? {
                name: table.group,
                rows: table.rows,
                round: table.round,
            }
        );
    });

    /** The form column, when any row has results. */
    readonly hasForm = computed(() =>
        this.shown().rows.some((row) => row.form.length > 0)
    );
    /** "Group A" → "Grupo A"; "Eastern Conference" → "Conferencia Este". */
    readonly group = computed(() => groupLabel(this.shown().name));

    readonly rows = computed(() =>
        this.shown().rows.map((row) => ({
            ...row,
            mine: isFollowedTeam(row.team),
        }))
    );
    /** The zones the rows shown reach, in the legend's order. */
    readonly legend = computed(() => {
        const present = new Set(this.shown().rows.map((row) => row.zone));
        return ZONES.filter((zone) => present.has(zone));
    });

    pick(index: number): void {
        this.selected.set(index);
    }

    zoneKey(zone: TableZone): string {
        return zone === 'europe' && SOUTH_AMERICAN.has(this.section().id)
            ? 'WORKSPACE.SPORTS.ZONES.SUDAMERICANA'
            : `WORKSPACE.SPORTS.ZONES.${zone.toUpperCase()}`;
    }
}

interface GroupLabel {
    readonly key: string;
    readonly params: Readonly<Record<string, string>>;
}

/** "Group A" → "Grupo A"; "Eastern Conference" → "Conferencia Este". */
function groupLabel(name: string | null): GroupLabel | null {
    const group = name ?? '';
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
}

/** A switch segment's text: a group's letter, else its name ("Zona A"). */
function shortName(name: string | null): string | null {
    return /^group\s+(\w+)$/i.exec(name ?? '')?.[1] ?? name;
}
