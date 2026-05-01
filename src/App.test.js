import { render, screen } from '@testing-library/react';
import App from './App';

test('renders attendance panel login', () => {
  render(<App />);
  const heading = screen.getByRole('heading', { name: /attendance panel/i });
  expect(heading).toBeInTheDocument();
});
