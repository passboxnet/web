/** Digits and symbols get their own colors so passwords are easier to read and type. */
export function ColoredPassword({ value }: { value: string }) {
  return (
    <>
      {Array.from(value).map((char, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: characters repeat; position is the identity
          key={index}
          className={/[0-9]/.test(char) ? "text-accent" : /[^\p{L}0-9]/u.test(char) ? "text-danger" : undefined}
        >
          {char}
        </span>
      ))}
    </>
  );
}
