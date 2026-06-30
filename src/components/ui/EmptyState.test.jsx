import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  test('renders title', () => {
    render(
      <EmptyState title="No decks found" />
    );

    expect(screen.getByText('No decks found')).toBeInTheDocument();
  });

  test('renders description when provided', () => {
    render(
      <EmptyState
        title="No decks found"
        description="Create your first deck to get started"
      />
    );

    expect(screen.getByText('Create your first deck to get started')).toBeInTheDocument();
  });

  test('does not render description when omitted', () => {
    render(
      <EmptyState title="No decks found" />
    );

    expect(screen.queryByText(/Create/)).not.toBeInTheDocument();
  });

  test('renders action Button when action prop provided, clicking it calls action.onClick', async () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        title="No decks found"
        action={{ label: 'Create Deck', onClick: handleClick }}
      />
    );

    const button = screen.getByRole('button', { name: 'Create Deck' });
    expect(button).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
