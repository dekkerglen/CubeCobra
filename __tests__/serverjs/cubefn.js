var sinon = require("sinon");

const cubefn = require("../../serverjs/cubefn");

beforeEach(() => {});

afterEach(() => {});

test("get_cube_id returns urlAlias when defined", () => {
    const testCube = {
        urlAlias: "a",
        shortID: "bbb",
        _id: "c"
    };
    const result = cubefn.get_cube_id(testCube);
    expect(result).toBe(testCube.urlAlias);
});

test("get_cube_id returns shortId when urlAlias is not present", () => {
    const testCube = {
        shortID: "bbb",
        _id: "c"
    };
    const result = cubefn.get_cube_id(testCube);
    expect(result).toBe(testCube.shortID);
});

test("get_cube_id returns _id when other ID fields are not present", () => {
    const testCube = {
        _id: "c"
    };
    const result = cubefn.get_cube_id(testCube);
    expect(result).toBe(testCube._id);
});

test("build_id_query returns a simple query when passed a 24-character alphanumeric string", () => {
    const testId = "a1a1a1a1a1a1a1a1a1a1a1a1";
    const result = cubefn.build_id_query(testId);
    expect(result._id).toBe(testId);
});

test("build_id_query returns a boolean query when passed a non-alphanumeric string", () => {
    const testId = "a1a-a1a1a1a1a1a1a1a1a1a1";
    const result = cubefn.build_id_query(testId);
    const condition = result["$or"];
    expect(condition.length).toBe(2);
    expect(condition[0].shortID).toBe(testId);
    expect(condition[1].urlAlias).toBe(testId);
});

test("intToLegality", () => {
    expect(cubefn.intToLegality(0)).toBe("Vintage");
    expect(cubefn.intToLegality(1)).toBe("Legacy");
    expect(cubefn.intToLegality(2)).toBe("Modern");
    expect(cubefn.intToLegality(3)).toBe("Standard");
    expect(cubefn.intToLegality(4)).toBe(undefined);
});

test("legalityToInt", () => {
    expect(cubefn.legalityToInt("Vintage")).toBe(0);
    expect(cubefn.legalityToInt("Legacy")).toBe(1);
    expect(cubefn.legalityToInt("Modern")).toBe(2);
    expect(cubefn.legalityToInt("Standard")).toBe(3);
    expect(cubefn.legalityToInt("not a format")).toBe(undefined);
});