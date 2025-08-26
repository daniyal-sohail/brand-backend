// middlewares/query.js
const queryHelper = (Model) => async (req, res, next) => {
  let query = Model.find();
  // Filtering
  const queryObj = { ...req.query };
  const excluded = ['page', 'limit', 'sort'];
  excluded.forEach(k => delete queryObj[k]);
  query = query.find(queryObj);
  // Sorting
  if (req.query.sort) {
    query = query.sort(req.query.sort);
  }
  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  query = query.skip(skip).limit(limit);
  const results = await query;
  const total = await Model.countDocuments(queryObj);
  res.json({
    total,
    page,
    pages: Math.ceil(total / limit),
    data: results,
  });
};
module.exports = queryHelper;