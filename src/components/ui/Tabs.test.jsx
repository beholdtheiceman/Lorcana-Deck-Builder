import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './Tabs';

describe('Tabs', () => {
  const mockTabs = [
    { label: 'Tab 1', value: 'tab1' },
    { label: 'Tab 2', value: 'tab2' },
    { label: 'Tab 3', value: 'tab3' },
  ];

  test('renders all tab labels', () => {
    const handleChange = vi.fn();
    render(
      <Tabs
        tabs={mockTabs}
        value="tab1"
        onChange={handleChange}
      />
    );

    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
    expect(screen.getByText('Tab 3')).toBeInTheDocument();
  });

  test('active tab has aria-selected="true"', () => {
    const handleChange = vi.fn();
    render(
      <Tabs
        tabs={mockTabs}
        value="tab2"
        onChange={handleChange}
      />
    );

    const activeTab = screen.getByRole('tab', { name: 'Tab 2' });
    expect(activeTab).toHaveAttribute('aria-selected', 'true');
  });

  test('inactive tab has aria-selected="false"', () => {
    const handleChange = vi.fn();
    render(
      <Tabs
        tabs={mockTabs}
        value="tab2"
        onChange={handleChange}
      />
    );

    const inactiveTab = screen.getByRole('tab', { name: 'Tab 1' });
    expect(inactiveTab).toHaveAttribute('aria-selected', 'false');
  });

  test('clicking inactive tab calls onChange with that tab\'s value', async () => {
    const handleChange = vi.fn();
    render(
      <Tabs
        tabs={mockTabs}
        value="tab1"
        onChange={handleChange}
      />
    );

    const user = userEvent.setup();
    const tab2 = screen.getByRole('tab', { name: 'Tab 2' });

    await user.click(tab2);

    expect(handleChange).toHaveBeenCalledWith('tab2');
  });
});
