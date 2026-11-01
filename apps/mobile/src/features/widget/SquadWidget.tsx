import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
import { t } from '../../i18n';
import { widgetHeading } from './heading';
import type { WidgetCard, WidgetView } from './snapshot';

export const WIDGET_NAME = 'SquadToday';
export const TICK_ACTION = 'TICK_TASK';

const BG = '#0E0E10';
const ROW = '#1C1C1F';
const LABEL = '#F5F5F7';
const MUTED = '#A1A1A8';
const ACCENT = '#FFB224';
const ON_ACCENT = '#1A1200';
const DONE = '#3DDC97';

/** Below this height there is only room for the summary line. */
const COMPACT_HEIGHT = 90;
/** Wide enough to let long task titles run to a second line. */
const WIDE_WIDTH = 300;

function Pill({ label, uri }: { label: string; uri: string }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: ACCENT,
      }}
    >
      <TextWidget text={label} style={{ fontSize: 13, fontWeight: '600', color: ON_ACCENT }} />
    </FlexWidget>
  );
}

function SquadHeader({ card }: { card: WidgetCard }) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        paddingBottom: 4,
      }}
    >
      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget
          text={card.squad}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 14, fontWeight: '700', color: LABEL }}
        />
        <TextWidget
          text={t('widget.squadCount', { checked: card.checked, members: card.members })}
          style={{ fontSize: 12, color: MUTED }}
        />
      </FlexWidget>
      {card.checkedIn ? (
        <TextWidget
          text={t('widget.checkedIn')}
          style={{ fontSize: 13, fontWeight: '600', color: DONE }}
        />
      ) : (
        <Pill label={t('widget.checkIn')} uri={`sparksquad://checkin/${card.challengeId}`} />
      )}
    </FlexWidget>
  );
}

function TaskRow({
  card,
  date,
  index,
  wide,
}: {
  card: WidgetCard;
  date: string;
  index: number;
  wide: boolean;
}) {
  const task = card.tasks[index]!;
  return (
    <FlexWidget
      {...(card.checkedIn
        ? { clickAction: 'OPEN_URI', clickActionData: { uri: 'sparksquad://today' } }
        : {
            clickAction: TICK_ACTION,
            clickActionData: { challengeId: card.challengeId, date, index },
          })}
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        paddingHorizontal: 10,
        paddingVertical: 9,
        borderRadius: 12,
        backgroundColor: ROW,
      }}
    >
      <FlexWidget
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          marginRight: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: task.done ? DONE : ROW,
          borderWidth: task.done ? 0 : 2,
          borderColor: MUTED,
        }}
      >
        {task.done ? (
          <TextWidget text="✓" style={{ fontSize: 13, fontWeight: '700', color: '#04140C' }} />
        ) : null}
      </FlexWidget>
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget
          text={task.title}
          maxLines={wide ? 2 : 1}
          truncate="END"
          style={{ fontSize: 14, color: task.done ? MUTED : LABEL }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * Lays itself out from the size Android reports, so it fits however it's resized: a summary line
 * when tiny, otherwise every task of every squad in a scrolling list you can tick from here.
 */
export function SquadWidget({
  view,
  width,
  height,
}: {
  view: WidgetView;
  width: number;
  height: number;
}) {
  const compact = height < COMPACT_HEIGHT;
  const wide = width >= WIDE_WIDTH;
  const cards = view.cards ?? [];
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'sparksquad://today' }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        padding: 12,
        borderRadius: 22,
        backgroundColor: BG,
      }}
    >
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text={widgetHeading(view)}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 16, fontWeight: '700', color: compact ? LABEL : ACCENT }}
          />
        </FlexWidget>
        {compact && view.left > 0 ? (
          <Pill label={t('widget.checkIn')} uri="sparksquad://checkin/next" />
        ) : null}
      </FlexWidget>
      {!compact && cards.length > 0 ? (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {cards.flatMap((card) => [
            <SquadHeader key={card.challengeId} card={card} />,
            ...card.tasks.map((_, i) => (
              <TaskRow
                key={`${card.challengeId}-${i}`}
                card={card}
                date={view.date}
                index={i}
                wide={wide}
              />
            )),
          ])}
        </ListWidget>
      ) : null}
    </FlexWidget>
  );
}
