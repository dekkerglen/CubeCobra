import React, { useContext, useMemo, useState } from 'react';

import { ArrowLeftIcon, UploadIcon } from '@primer/octicons-react';
import Cube from '@utils/datatypes/Cube';
import { RECORD_EXPORT_FORMAT, RECORD_EXPORT_VERSION, RecordExportEntry } from '@utils/datatypes/RecordExport';
import { getCubeId } from '@utils/Util';

import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import TextArea from 'components/base/TextArea';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

// Matches the server's per-request limit.
const BATCH_SIZE = 25;

interface ImportRecordsFilePageProps {
  cube: Cube;
}

interface ParsedFile {
  records: RecordExportEntry[];
  sourceName?: string;
}

// Checks the file's shape enough to preview it; the server validates every field.
const parseRecordsFile = (text: string): ParsedFile => {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This isn't valid JSON.");
  }
  if (data?.format !== RECORD_EXPORT_FORMAT || !Array.isArray(data.records)) {
    throw new Error('This file isn\'t a Cube Cobra records export (expected "format": "cubecobra-records").');
  }
  if (typeof data.version !== 'number' || data.version > RECORD_EXPORT_VERSION) {
    throw new Error(`This file uses format version ${data.version}, which this page doesn't support yet.`);
  }
  data.records.forEach((r: any, i: number) => {
    if (typeof r?.name !== 'string' || typeof r?.date !== 'number' || !Array.isArray(r?.players)) {
      throw new Error(`Record ${i + 1} is missing its name, date, or players.`);
    }
  });
  if (data.records.length === 0) throw new Error('This file has no records in it.');
  return { records: data.records, sourceName: data.source?.cubeName };
};

const ImportRecordsFilePage: React.FC<ImportRecordsFilePageProps> = ({ cube }) => {
  const { callApi } = useContext(CSRFContext);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ created: number; warnings: string[]; error?: string } | null>(null);

  const recordsUrl = `/cube/records/${getCubeId(cube)}`;

  const load = (input: string) => {
    setText(input);
    setResult(null);
    try {
      const file = parseRecordsFile(input);
      setParsed(file);
      setSelected(new Set(file.records.map((_, i) => i)));
      setParseError(null);
    } catch (err) {
      setParsed(null);
      setParseError(err instanceof Error ? err.message : 'Could not read this file.');
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) load(await file.text());
    event.target.value = '';
  };

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const chosen = useMemo(
    () => (parsed ? parsed.records.filter((_, i) => selected.has(i)) : []),
    [parsed, selected],
  );

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    let created = 0;
    const warnings: string[] = [];
    let error: string | undefined;
    for (let i = 0; i < chosen.length; i += BATCH_SIZE) {
      const batch = chosen.slice(i, i + BATCH_SIZE);
      try {
        const res = await callApi(`/cube/records/importfile/${getCubeId(cube)}`, { records: batch });
        const json = await res.json();
        if (!res.ok || json.success !== 'true') {
          error = json.error || json.message || 'The import failed.';
          break;
        }
        created += json.created.length;
        warnings.push(...json.warnings);
      } catch {
        error = 'The import failed — check your connection and try again.';
        break;
      }
      setProgress(Math.min(chosen.length, i + batch.length));
    }
    setResult({ created, warnings, error });
    setImporting(false);
  };

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} activeLink="records">
        <DynamicFlash />
        <Card className="my-2">
          <CardHeader>
            <Flexbox direction="row" justify="between" alignItems="center">
              <Text lg semibold>
                Import Records from File
              </Text>
              <Link href={recordsUrl}>
                <Flexbox direction="row" gap="1" alignItems="center">
                  <ArrowLeftIcon size={16} /> Back to records
                </Flexbox>
              </Link>
            </Flexbox>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text sm className="text-text-secondary">
                Upload a records file exported from any cube on Cube Cobra, or one made by another tool in the same
                format (see the <Link href="/help/apidocs#record-files">format documentation</Link>). Each record is
                added as a new record in this cube, with its decks — importing the same records twice will create
                duplicates.
              </Text>

              {!result && (
                <>
                  <Flexbox direction="row" gap="2" alignItems="center">
                    <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded bg-bg-active border border-border hover:bg-bg-active-hover transition-colors text-sm font-medium">
                      <UploadIcon size={16} />
                      Upload JSON File
                      <input type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
                    </label>
                  </Flexbox>
                  <TextArea
                    value={text}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => load(e.target.value)}
                    placeholder="…or paste the file's contents here"
                    className="font-mono text-sm"
                    rows={parsed ? 4 : 10}
                  />
                  {parseError && text.trim() && (
                    <Text sm className="text-danger">
                      {parseError}
                    </Text>
                  )}
                </>
              )}

              {parsed && !result && (
                <Flexbox direction="col" gap="2">
                  <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
                    <Text md semibold>
                      {parsed.records.length} record{parsed.records.length === 1 ? '' : 's'}
                      {parsed.sourceName ? ` from ${parsed.sourceName}` : ''}
                    </Text>
                    <Flexbox direction="row" gap="3">
                      <Link onClick={() => setSelected(new Set(parsed.records.map((_, i) => i)))}>Select all</Link>
                      <Link onClick={() => setSelected(new Set())}>Select none</Link>
                    </Flexbox>
                  </Flexbox>
                  <div className="border border-border rounded divide-y divide-border max-h-[28rem] overflow-y-auto">
                    {parsed.records.map((record, i) => {
                      const deckCount = Object.values(record.decks ?? {}).filter(
                        (d) => (d?.mainboard?.length ?? 0) > 0,
                      ).length;
                      const roundCount = record.rounds?.length ?? 0;
                      return (
                        <label key={i} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-bg-active">
                          <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{record.name}</div>
                            <div className="text-xs text-text-secondary">
                              <FormatttedDate date={record.date} /> · {record.players.length} player
                              {record.players.length === 1 ? '' : 's'} · {deckCount} deck{deckCount === 1 ? '' : 's'} ·{' '}
                              {roundCount} round{roundCount === 1 ? '' : 's'}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <Flexbox direction="row" gap="3" alignItems="center">
                    <Button color="primary" onClick={handleImport} disabled={importing || chosen.length === 0}>
                      {importing
                        ? `Importing… ${progress} / ${chosen.length}`
                        : `Import ${chosen.length} record${chosen.length === 1 ? '' : 's'}`}
                    </Button>
                  </Flexbox>
                </Flexbox>
              )}

              {result && (
                <Flexbox direction="col" gap="2">
                  {result.error ? (
                    <Alert color="danger">
                      {result.error}
                      {result.created > 0 && ` ${result.created} record${result.created === 1 ? ' was' : 's were'} imported before it stopped.`}
                    </Alert>
                  ) : (
                    <Alert color="success">
                      Imported {result.created} record{result.created === 1 ? '' : 's'}.
                    </Alert>
                  )}
                  {result.warnings.length > 0 && (
                    <Alert color="warning">
                      <Text sm semibold>
                        Imported with some problems:
                      </Text>
                      <ul className="list-disc list-inside text-sm mt-1">
                        {result.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </Alert>
                  )}
                  <Flexbox direction="row" gap="3">
                    <Button type="link" color="primary" href={recordsUrl}>
                      View records
                    </Button>
                  </Flexbox>
                </Flexbox>
              )}
            </Flexbox>
          </CardBody>
        </Card>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(ImportRecordsFilePage);
