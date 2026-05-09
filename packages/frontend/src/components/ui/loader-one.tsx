export const LoaderOne = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-3 h-3 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
          />
        ))}
      </div>
      <p className="text-sm font-medium text-muted-foreground animate-pulse">
        Buscando dados do Asaas...
      </p>
    </div>
  );
};
