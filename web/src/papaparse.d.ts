declare module "papaparse" {
  const Papa: {
    parse(input: string, config: { delimiter: string }): {
      data: string[][];
      errors: Array<{ message: string; row?: number }>;
    };
  };
  export default Papa;
}
