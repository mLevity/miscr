export function Disclaimer({ children }: { children: string }) {
  return (
    <p className="tool-disclaimer" role="note">
      {children}
    </p>
  );
}
