import { isValidCalendarDate, isValidMatrikel } from '@einlass/shared';
import { Button, Flex, Input, type InputRef, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { CheckedInput } from './ResultOverlay';

const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

/** Manuelle Eingabe: Matrikelnummer + Geburtsdatum (TT MM JJJJ, Fokus springt automatisch weiter). */
export function ManualEntry({
  initial,
  loading,
  onSubmit,
  onCancel,
}: {
  initial?: CheckedInput | null;
  loading: boolean;
  onSubmit: (input: CheckedInput) => void;
  onCancel: () => void;
}) {
  const [m, setM] = useState(initial?.matrikelnummer ?? '');
  const [day, setDay] = useState(initial ? initial.birthDate.slice(8, 10) : '');
  const [month, setMonth] = useState(initial ? initial.birthDate.slice(5, 7) : '');
  const [year, setYear] = useState(initial ? initial.birthDate.slice(0, 4) : '');
  const refs = {
    m: useRef<InputRef>(null),
    day: useRef<InputRef>(null),
    month: useRef<InputRef>(null),
    year: useRef<InputRef>(null),
  };

  const firstInput = refs.m;
  useEffect(() => firstInput.current?.focus(), [firstInput]);

  const date = { year: Number(year), month: Number(month), day: Number(day) };
  const dateOk = year.length === 4 && isValidCalendarDate(date);
  const valid = isValidMatrikel(m) && dateOk;

  const submit = () =>
    valid &&
    onSubmit({
      matrikelnummer: m,
      birthDate: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
    });

  const big = { fontSize: 24, textAlign: 'center' as const, fontFamily: 'monospace' };

  return (
    <Flex vertical gap={16} style={{ width: '100%', maxWidth: 420 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Manuelle Eingabe
      </Typography.Title>
      <div>
        <Typography.Text type="secondary">Matrikelnummer</Typography.Text>
        <Input
          ref={refs.m}
          size="large"
          inputMode="numeric"
          autoComplete="off"
          placeholder="12345"
          value={m}
          style={big}
          onChange={(e) => {
            const v = digits(e.target.value, 5);
            setM(v);
            if (v.length === 5) refs.day.current?.focus();
          }}
        />
      </div>
      <div>
        <Typography.Text type="secondary">Geburtsdatum</Typography.Text>
        <Flex gap={8}>
          <Input
            ref={refs.day}
            size="large"
            inputMode="numeric"
            placeholder="TT"
            value={day}
            style={big}
            onChange={(e) => {
              const v = digits(e.target.value, 2);
              setDay(v);
              if (v.length === 2) refs.month.current?.focus();
            }}
          />
          <Input
            ref={refs.month}
            size="large"
            inputMode="numeric"
            placeholder="MM"
            value={month}
            style={big}
            onChange={(e) => {
              const v = digits(e.target.value, 2);
              setMonth(v);
              if (v.length === 2) refs.year.current?.focus();
            }}
          />
          <Input
            ref={refs.year}
            size="large"
            inputMode="numeric"
            placeholder="JJJJ"
            value={year}
            style={{ ...big, flex: 2 }}
            onChange={(e) => setYear(digits(e.target.value, 4))}
            onPressEnter={submit}
          />
        </Flex>
        {year.length === 4 && !dateOk && (
          <Typography.Text type="danger">Ungültiges Datum</Typography.Text>
        )}
      </div>
      <Button
        type="primary"
        size="large"
        block
        disabled={!valid}
        loading={loading}
        onClick={submit}
      >
        Prüfen
      </Button>
      <Button size="large" block onClick={onCancel}>
        Zurück zur Kamera
      </Button>
    </Flex>
  );
}
