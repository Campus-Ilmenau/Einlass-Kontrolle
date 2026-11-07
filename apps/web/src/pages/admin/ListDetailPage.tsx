import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons';
import {
  type AddEntriesResult,
  type EntriesPage,
  type FreeList,
  type ImportMode,
  type ImportReport,
  parseMatrikelList,
} from '@einlass/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Flex,
  Input,
  List,
  Pagination,
  Popconfirm,
  Radio,
  Spin,
  Typography,
  Upload,
} from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation } from '../../lib/mutation';
import { LISTS_KEY } from './EventsPage';
import { ListFormModal } from './ListsPage';
import { ListEventTags, useAssignToActiveEvent } from './listEvents';

const PAGE_SIZE = 50;

function AddEntries({ listId }: { listId: string }) {
  const [text, setText] = useState('');
  const parsed = parseMatrikelList(text);
  const add = useApiMutation(
    (matrikelnummern: string[]) =>
      api<AddEntriesResult>(`/admin/lists/${listId}/entries`, {
        method: 'POST',
        body: { matrikelnummern },
      }),
    {
      invalidate: [LISTS_KEY],
      success: (r) =>
        `${r.added} hinzugefügt${r.alreadyInList ? `, ${r.alreadyInList} schon vorhanden` : ''}`,
    },
  );

  return (
    <Flex vertical gap={8}>
      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          'Matrikelnummern eintippen oder einfügen\n(eine pro Zeile, oder mit Komma/Semikolon getrennt)'
        }
        autoSize={{ minRows: 3, maxRows: 10 }}
        inputMode="numeric"
      />
      {text.trim() && (
        <Typography.Text type={parsed.invalid.length ? 'warning' : 'secondary'}>
          {parsed.valid.length} gültig
          {parsed.duplicates.length ? `, ${parsed.duplicates.length} doppelt` : ''}
          {parsed.invalid.length ? `, ungültig: ${parsed.invalid.slice(0, 5).join(', ')}` : ''}
        </Typography.Text>
      )}
      <Button
        type="primary"
        disabled={parsed.valid.length === 0}
        loading={add.isPending}
        onClick={async () => {
          await add.mutateAsync(parsed.valid);
          setText('');
        }}
      >
        {parsed.valid.length || ''} Hinzufügen
      </Button>
    </Flex>
  );
}

function ImportFile({ listId }: { listId: string }) {
  const [mode, setMode] = useState<ImportMode>('append');
  const [column, setColumn] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const upload = useApiMutation(
    (file: File) => {
      const form = new FormData();
      form.append('mode', mode);
      if (column.trim()) form.append('column', column.trim());
      form.append('file', file);
      return api<ImportReport>(`/admin/lists/${listId}/import`, { method: 'POST', body: form });
    },
    { invalidate: [LISTS_KEY], success: 'Import abgeschlossen' },
  );

  return (
    <Flex vertical gap={8}>
      <Typography.Text type="secondary">
        CSV (Trennzeichen ; , oder Tab) oder Excel (.xlsx), max. 5 MB. Die Spalte mit den
        Matrikelnummern wird automatisch erkannt.
      </Typography.Text>
      <Radio.Group
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        optionType="button"
        buttonStyle="solid"
        options={[
          { value: 'append', label: 'Ergänzen' },
          { value: 'replace', label: 'Ersetzen' },
        ]}
      />
      <Input
        value={column}
        onChange={(e) => setColumn(e.target.value)}
        placeholder="Spalte (optional): Überschrift oder Nummer"
      />
      <Upload
        accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        showUploadList={false}
        beforeUpload={(file) => {
          setReport(null);
          upload.mutateAsync(file).then(setReport, () => undefined);
          return false;
        }}
      >
        <Button icon={<UploadOutlined />} loading={upload.isPending} block>
          Datei auswählen
        </Button>
      </Upload>
      {report && (
        <Alert
          type={report.invalidCount ? 'warning' : 'success'}
          showIcon
          message={`${report.added} neu, ${report.alreadyInList} schon vorhanden${
            report.mode === 'replace' ? `, ${report.removed} entfernt` : ''
          }`}
          description={
            <>
              Spalte „{report.column}“, {report.rows} Zeilen
              {report.duplicatesInFile ? `, ${report.duplicatesInFile} doppelt in der Datei` : ''}
              {report.invalidCount > 0 && (
                <>
                  <br />
                  {report.invalidCount} ungültig:{' '}
                  {report.invalid
                    .slice(0, 10)
                    .map((i) => `Zeile ${i.row} („${i.value}“)`)
                    .join(', ')}
                  {report.invalidCount > 10 ? ' …' : ''}
                </>
              )}
            </>
          }
        />
      )}
    </Flex>
  );
}

export function ListDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [renaming, setRenaming] = useState(false);
  const { active, assign, pending: assigning } = useAssignToActiveEvent();

  const lists = useQuery({ queryKey: LISTS_KEY, queryFn: () => api<FreeList[]>('/admin/lists') });
  const list = lists.data?.find((l) => l.id === id);
  const entries = useQuery({
    queryKey: [...LISTS_KEY, id, 'entries', search, page],
    queryFn: () =>
      api<EntriesPage>(
        `/admin/lists/${id}/entries?page=${page}&pageSize=${PAGE_SIZE}${search ? `&search=${search}` : ''}`,
      ),
    placeholderData: (prev) => prev,
  });

  const removeEntry = useApiMutation(
    (entryId: string) => api(`/admin/lists/${id}/entries/${entryId}`, { method: 'DELETE' }),
    { invalidate: [LISTS_KEY] },
  );
  const clear = useApiMutation(
    () => api<{ removed: number }>(`/admin/lists/${id}/entries`, { method: 'DELETE' }),
    { invalidate: [LISTS_KEY], success: (r) => `${r.removed} Nummern entfernt` },
  );
  const removeList = useApiMutation(() => api(`/admin/lists/${id}`, { method: 'DELETE' }), {
    invalidate: [LISTS_KEY],
    success: 'Liste gelöscht',
  });

  if (lists.isPending) return <Spin />;
  if (!list) return <Alert type="error" message="Liste nicht gefunden" />;

  return (
    <Flex vertical gap={12}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/admin/lists')}
        style={{ alignSelf: 'start' }}
      >
        Freilisten
      </Button>
      <Flex justify="space-between" align="start" gap={8}>
        <Flex vertical style={{ minWidth: 0 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {list.name}
          </Typography.Title>
          <Typography.Text type="secondary">
            {list.entryCount} Nummern{list.description ? ` · ${list.description}` : ''}
          </Typography.Text>
        </Flex>
        <Flex gap={4}>
          <Button
            icon={<EditOutlined />}
            aria-label="Umbenennen"
            onClick={() => setRenaming(true)}
          />
          <Popconfirm
            title="Ganze Liste löschen?"
            description="Sie wird auch aus allen Veranstaltungen entfernt."
            okText="Löschen"
            cancelText="Abbrechen"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              await removeList.mutateAsync(undefined);
              navigate('/admin/lists', { replace: true });
            }}
          >
            <Button danger icon={<DeleteOutlined />} aria-label="Liste löschen" />
          </Popconfirm>
        </Flex>
      </Flex>

      <Flex gap={4} wrap>
        <ListEventTags list={list} />
      </Flex>

      {/* Ohne Zuordnung zur laufenden Veranstaltung zählt die Liste beim Scannen nicht */}
      {active && !list.events.some((e) => e.id === active.id) && (
        <Alert
          type="warning"
          showIcon
          message={`Nicht in der laufenden Veranstaltung „${active.name}“`}
          description="Nummern auf dieser Liste bekommen dort keinen freien Eintritt."
          action={
            <Button size="small" type="primary" loading={assigning} onClick={() => void assign(id)}>
              Zuordnen
            </Button>
          }
        />
      )}
      {!active && list.events.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message="Keiner Veranstaltung zugeordnet"
          description={
            <>
              Nummern auf dieser Liste bekommen erst freien Eintritt, wenn die Liste einer
              Veranstaltung zugeordnet ist (Abende → Bearbeiten → Freilisten).{' '}
              <a onClick={() => navigate('/admin/events')}>Zu den Abenden</a>
            </>
          }
        />
      )}

      <Collapse
        items={[
          { key: 'add', label: 'Nummern hinzufügen', children: <AddEntries listId={id} /> },
          {
            key: 'import',
            label: 'Datei importieren (CSV / Excel)',
            children: <ImportFile listId={id} />,
          },
        ]}
      />

      <Card
        size="small"
        title="Einträge"
        extra={
          list.entryCount > 0 && (
            <Popconfirm
              title="Alle Nummern entfernen?"
              okText="Leeren"
              cancelText="Abbrechen"
              okButtonProps={{ danger: true }}
              onConfirm={() => clear.mutate(undefined)}
            >
              <Button size="small" danger>
                Leeren
              </Button>
            </Popconfirm>
          )
        }
      >
        <Input.Search
          placeholder="Nummer suchen"
          inputMode="numeric"
          allowClear
          maxLength={5}
          onSearch={(v) => {
            setSearch(v.replace(/\D/g, ''));
            setPage(1);
          }}
          style={{ marginBottom: 8 }}
        />
        <List
          loading={entries.isFetching}
          dataSource={entries.data?.items ?? []}
          locale={{ emptyText: 'Keine Einträge' }}
          renderItem={(e) => (
            <List.Item
              actions={[
                <Button
                  key="del"
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  aria-label={`${e.matrikelnummer} entfernen`}
                  onClick={() => removeEntry.mutate(e.id)}
                />,
              ]}
            >
              <Typography.Text style={{ fontFamily: 'monospace', fontSize: 16 }}>
                {e.matrikelnummer}
              </Typography.Text>
            </List.Item>
          )}
        />
        {(entries.data?.total ?? 0) > PAGE_SIZE && (
          <Pagination
            size="small"
            current={page}
            pageSize={PAGE_SIZE}
            total={entries.data?.total}
            onChange={setPage}
            showSizeChanger={false}
            style={{ marginTop: 8, textAlign: 'center' }}
          />
        )}
      </Card>

      <ListFormModal open={renaming} list={list} onClose={() => setRenaming(false)} />
    </Flex>
  );
}
