import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import type { LeagueTable } from '../league-tables';
import { findSportSection, type SportSection } from '../sport-sections';
import { LeagueTableComponent } from './league-table.component';

const row = (
    rank: number,
    team: string,
    zone: LeagueTable['rows'][number]['zone'],
    form: ('W' | 'D' | 'L')[] = []
) => ({ rank, team, badge: null, played: 9, points: 30 - rank, form, zone });

function render(table: LeagueTable, sectionId = 'premier-league') {
    TestBed.configureTestingModule({
        imports: [LeagueTableComponent, TranslateModule.forRoot()],
    });
    const fixture = TestBed.createComponent(LeagueTableComponent);
    fixture.componentRef.setInput('table', table);
    fixture.componentRef.setInput(
        'section',
        findSportSection(sectionId) as SportSection
    );
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
}

describe('LeagueTableComponent', () => {
    it('lists every row, the followed teams highlighted, with its zones', () => {
        const element = render({
            rows: [
                row(1, 'Arsenal', 'champions'),
                row(2, 'West Ham United', null),
                row(3, 'Wolves', 'relegation'),
            ],
            round: 9,
            group: null,
        });

        expect(element.querySelectorAll('[role="row"]')).toHaveLength(4);
        expect(
            element.querySelector('.table__row--mine')?.textContent
        ).toContain('West Ham United');
        expect(
            Array.from(element.querySelectorAll('.table__zone')).map((zone) =>
                zone.textContent?.trim()
            )
        ).toEqual([
            'WORKSPACE.SPORTS.ZONES.CHAMPIONS',
            'WORKSPACE.SPORTS.ZONES.RELEGATION',
        ]);
    });

    it('drops the form column when the source gives none', () => {
        const without = render({
            rows: [row(1, 'Arsenal', null)],
            round: 9,
            group: null,
        });
        expect(without.querySelector('.table--no-form')).not.toBeNull();
        expect(without.querySelector('.table__form')).toBeNull();

        TestBed.resetTestingModule();
        const withForm = render({
            rows: [row(1, 'Arsenal', null, ['W', 'D'])],
            round: 9,
            group: null,
        });
        expect(withForm.querySelectorAll('.table__result')).toHaveLength(2);
    });

    it('names a group, and South America’s second cup', () => {
        const element = render(
            {
                rows: [row(1, 'River Plate', 'europe')],
                round: 16,
                group: 'Group B',
            },
            'libertadores'
        );

        expect(element.querySelector('.table__note')?.textContent).toContain(
            'WORKSPACE.SPORTS.TABLE_GROUP'
        );
        expect(element.querySelector('.table__zone')?.textContent).toContain(
            'WORKSPACE.SPORTS.ZONES.SUDAMERICANA'
        );
    });
});
