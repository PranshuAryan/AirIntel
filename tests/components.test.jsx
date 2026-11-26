// @vitest-environment jsdom
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, cleanup, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {axe} from 'jest-axe';
import {MemoryRouter} from 'react-router-dom';
import {Ctx} from '../src/AppContext.js';
import SearchBox from '../src/components/SearchBox.jsx';
import ErrorBoundary from '../src/components/ErrorBoundary.jsx';
import SrTable from '../src/components/SrTable.jsx';
import Plan from '../src/pages/Plan.jsx';
import {PROFILE_DEFAULT} from '../src/services/plan.js';

vi.mock('../src/services/apiController.js', () => ({
  geocode: vi.fn(async () => [{label: 'Delhi, India', lat: 28.6, lon: 77.2, cc: 'in'}, {label: 'Delhi, Ohio, USA', lat: 40.3, lon: -83, cc: 'us'}]),
  hourlyForecast: vi.fn(async () => [30, 20, 12, 18, 40, 90, 120].map((pm25, i) => ({ts: i, hour: 10 + i, pm25}))),
  getAirQuality: vi.fn(),
}));
vi.mock('../src/services/groq.js', () => ({askJSON: vi.fn(async () => { throw new Error('Groq key missing'); })}));

afterEach(cleanup);
const A11Y = {rules: {'color-contrast': {enabled: false}}}; // jsdom cannot compute colours; contrast is handled in the design tokens
const FUTURE = {v7_startTransition: true, v7_relativeSplatPath: true};

describe('SearchBox (ARIA combobox)', () => {
  it('is keyboard operable and announces results', async () => {
    const onSelect = vi.fn(), user = userEvent.setup();
    render(<SearchBox onSelect={onSelect}/>);
    const box = screen.getByRole('combobox', {name: /search location/i});
    expect(box.getAttribute('aria-expanded')).toBe('false');
    await user.type(box, 'delhi');
    const opts = await screen.findAllByRole('option');
    expect(opts).toHaveLength(2);
    expect(box.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(box.getAttribute('aria-activedescendant')).toBe(opts[1].id);
    expect(opts[1].getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({label: 'Delhi, Ohio, USA'}));
    expect(box.value).toBe('');
  });
  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<SearchBox onSelect={() => {}}/>);
    const box = screen.getByRole('combobox');
    await user.type(box, 'delhi'); await screen.findAllByRole('option');
    await user.keyboard('{Escape}');
    expect(box.getAttribute('aria-expanded')).toBe('false');
  });
  it('has no axe violations', async () => {
    const user = userEvent.setup();
    const {container} = render(<SearchBox onSelect={() => {}}/>);
    await user.type(screen.getByRole('combobox'), 'delhi'); await screen.findAllByRole('option');
    expect((await axe(container, A11Y)).violations).toEqual([]);
  });
});

describe('ErrorBoundary', () => {
  it('shows an alert instead of a blank page', () => {
    const Boom = () => { throw new Error('x'); };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary resetKey="a"><Boom/></ErrorBoundary>);
    expect(screen.getByRole('alert').textContent).toMatch(/something went wrong/i);
    spy.mockRestore();
  });
});

describe('SrTable', () => {
  it('exposes chart data with proper headers', () => {
    render(<SrTable caption="Data" headers={['Day', 'AQI']} rows={[['Mon', 100], ['Tue', null]]}/>);
    expect(screen.getByRole('table', {name: 'Data'})).toBeTruthy();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getByText('no data')).toBeTruthy();
  });
});

function renderPlan(over = {}) {
  const value = {place: {label: 'Patna, India', lat: 25.6, lon: 85.1, cc: 'in'}, air: {aqi: 250, std: 'us', pollutants: {pm25: {conc: 150}}}, loading: false, err: '', profile: {...PROFILE_DEFAULT, kids: true}, setProfile: vi.fn(), ...over};
  return {value, ...render(<MemoryRouter future={FUTURE}><Ctx.Provider value={value}><Plan/></Ctx.Provider></MemoryRouter>)};
}

describe('Clean-Air Plan page', () => {
  it('renders an instant rule-based plan with direct impact for each action, and falls back gracefully when AI is down', async () => {
    renderPlan();
    expect(screen.getByRole('heading', {level: 1, name: /clean-air plan/i})).toBeTruthy();
    expect(screen.getAllByText(/direct impact/i).length).toBeGreaterThan(3);
    expect(screen.getByRole('heading', {level: 2, name: /indoor air hacks/i})).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/AI personalisation unavailable/i)).toBeTruthy(), {timeout: 3000});
    expect(screen.getByText(/Rule-based plan/i)).toBeTruthy();
  });
  it('shows the cleanest forecast window labelled as a model estimate', async () => {
    renderPlan();
    expect(await screen.findByText(/Cleanest window in the next 24 h: 12 pm–2 pm/)).toBeTruthy();
    expect(screen.getByText(/MODEL FORECAST/)).toBeTruthy();
  });
  it('tracks progress when actions are ticked', async () => {
    const user = userEvent.setup();
    renderPlan();
    const boxes = screen.getAllByRole('checkbox').filter(b => b.id.startsWith('act-'));
    expect(screen.getByText(/0 of \d+ actions done/)).toBeTruthy();
    await user.click(boxes[0]);
    expect(screen.getByText(/1 of \d+ actions done/)).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
  });
  it('saves profile changes through setProfile', async () => {
    const user = userEvent.setup(), {value} = renderPlan();
    await user.selectOptions(screen.getByLabelText(/cooking fuel/i), 'biomass');
    expect(value.setProfile).toHaveBeenCalledWith(expect.objectContaining({cooking: 'biomass'}));
  });
  it('explains missing live data instead of failing', () => {
    renderPlan({air: null, err: 'No station within range.'});
    expect(screen.getByText(/No live reading for this place/i)).toBeTruthy();
    expect(screen.getByRole('heading', {level: 2, name: /daily routine|indoor/i})).toBeTruthy();
  });
  it('has no axe violations (labels, roles, headings, landmarks)', async () => {
    const {container} = renderPlan();
    await screen.findByText(/Cleanest window/);
    expect((await axe(container, A11Y)).violations).toEqual([]);
  });
});
