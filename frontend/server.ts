import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { railwayStore } from './src/server/store';
import { predictArrivalDelay } from './src/server/forecast';
import { parseDisruptionText } from './src/server/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // API Health probe
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'RailFlow Timetable & Disruption Management Engine',
      version: '1.4.0',
      timestamp: new Date().toISOString(),
      active_station: 'ST01',
      scheduler_status: 'nominal',
      independent_validator: 'online',
    });
  });

  // Stations profiles
  app.get('/api/stations', (req: Request, res: Response) => {
    res.json({
      stations: railwayStore.getAllStations(),
    });
  });

  // Platforms for a station
  app.get('/api/platforms', (req: Request, res: Response) => {
    const stationCode = (req.query.station_code as string) || 'ST01';
    res.json({
      station_code: stationCode,
      platforms: railwayStore.getPlatforms(stationCode),
    });
  });

  // Timetable
  app.get('/api/timetable', (req: Request, res: Response) => {
    const stationCode = (req.query.station_code as string) || 'ST01';
    const platformId = req.query.platform_id as string | undefined;
    const status = req.query.status as string | undefined;

    const items = railwayStore.getTimetable(stationCode, platformId, status);
    res.json({
      station_code: stationCode,
      total_trains: items.length,
      timetable: items,
    });
  });

  // Conflicts
  app.get('/api/conflicts', (req: Request, res: Response) => {
    const stationCode = (req.query.station_code as string) || 'ST01';
    const severity = req.query.severity as string | undefined;

    const conflicts = railwayStore.getConflicts(stationCode, severity);
    res.json({
      station_code: stationCode,
      total_conflicts: conflicts.length,
      conflicts,
    });
  });

  // Independent Schedule Validation
  app.post('/api/schedule/validate', (req: Request, res: Response) => {
    const { station_code = 'ST01', schedule } = req.body;
    try {
      const result = railwayStore.validate(station_code, schedule);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({
        validation_state: 'ERROR',
        message: err.message || 'Validation failed',
      });
    }
  });

  // Train Delay Disruption
  app.post('/api/disruptions/delay', (req: Request, res: Response) => {
    const { train_id, delay_minutes, reason, station_code = 'ST01' } = req.body;

    if (!train_id) {
      return res.status(400).json({ error: 'Missing required field: train_id' });
    }
    if (typeof delay_minutes !== 'number' || delay_minutes < 0) {
      return res.status(400).json({
        error: 'Invalid delay_minutes: must be a non-negative number',
      });
    }

    try {
      const result = railwayStore.applyTrainDelay(
        train_id,
        delay_minutes,
        reason || 'Operational delay',
        station_code
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Platform Closure Disruption
  app.post('/api/disruptions/closure', (req: Request, res: Response) => {
    const { platform_id, closure_start, closure_end, reason, station_code = 'ST01' } = req.body;

    if (!platform_id || !closure_start || !closure_end) {
      return res.status(400).json({
        error: 'Missing required fields: platform_id, closure_start, closure_end',
      });
    }

    try {
      const result = railwayStore.applyPlatformClosure(
        platform_id,
        closure_start,
        closure_end,
        reason || 'Track maintenance',
        station_code
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Reopen platform
  app.post('/api/platforms/reopen', (req: Request, res: Response) => {
    const { platform_id, station_code = 'ST01' } = req.body;
    try {
      const result = railwayStore.reopenPlatform(platform_id, station_code);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Replanning endpoint
  app.post('/api/schedule/replan', (req: Request, res: Response) => {
    const { station_code = 'ST01' } = req.body;
    try {
      const result = railwayStore.replan(station_code);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Adopt candidate schedule
  app.post('/api/schedule/adopt', (req: Request, res: Response) => {
    const { station_code = 'ST01' } = req.body;
    try {
      const result = railwayStore.adoptCandidate(station_code);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Reset timetable
  app.post('/api/schedule/reset', (req: Request, res: Response) => {
    const { station_code = 'ST01' } = req.body;
    try {
      const result = railwayStore.resetTimetable(station_code);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Experimental Delay Forecast
  app.post('/api/predictions/arrival-delay', (req: Request, res: Response) => {
    const { train_id, station_code, service_date, seq } = req.body;
    if (!train_id || !station_code) {
      return res.status(400).json({
        error: 'Missing required fields: train_id, station_code',
      });
    }

    const result = predictArrivalDelay({
      train_id,
      station_code,
      service_date,
      seq,
    });
    res.json(result);
  });

  // Operations Assistant Disruption Text Parser
  app.post('/api/disruptions/parse', (req: Request, res: Response) => {
    const { text, station_code = 'ST01' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text prompt string is required' });
    }

    const parsed = parseDisruptionText(text, station_code);
    res.json(parsed);
  });

  // Schedule History
  app.get('/api/schedule/history', (req: Request, res: Response) => {
    const stationCode = req.query.station_code as string | undefined;
    const history = railwayStore.getHistory(stationCode);
    res.json({
      station_code: stationCode || 'ALL',
      total_entries: history.length,
      history,
    });
  });

  // Disruptions audit
  app.get('/api/disruptions', (req: Request, res: Response) => {
    const stationCode = req.query.station_code as string | undefined;
    const records = railwayStore.getDisruptions(stationCode);
    res.json({
      total: records.length,
      disruptions: records,
    });
  });

  // Vite middleware in dev or static serving in prod
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`RailFlow Engine listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
