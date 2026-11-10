"""Training-time head metric: the share of a target set found in the top 120% of predictions."""

import tensorflow as tf
from tensorflow.keras.metrics import Metric


class TopRatedPercent(Metric):
    def __init__(self, name="top_rated_percent", **kwargs):
        super().__init__(name=name, **kwargs)
        # these two variables will accumulate over batches
        self.total_score = self.add_weight(name="total_score", initializer="zeros")
        self.count = self.add_weight(name="count", initializer="zeros")

    def update_state(self, y_true, y_pred, sample_weight=None):
        # ensure float32
        y_true = tf.cast(y_true, tf.float32)

        def _per_sample(inputs):
            truth, pred = inputs
            # how many true positives?
            n_true = tf.reduce_sum(truth)  # e.g. 5.0
            # take 120% of those, round up
            k = tf.cast(tf.math.ceil(n_true * 1.2), tf.int32)
            # but don't exceed the number of classes
            num_classes = tf.shape(truth)[-1]
            k = tf.minimum(k, num_classes)
            # get top-k predictions
            _, top_indices = tf.nn.top_k(pred, k=k, sorted=False)
            # count hits by gathering truth at those indices
            hits = tf.reduce_sum(tf.gather(truth, top_indices))
            # add-one smoothing
            return (hits + 1.0) / (n_true + 1.0)

        # map that over the batch dimension
        scores = tf.map_fn(_per_sample, (y_true, y_pred), dtype=tf.float32)
        batch_sum = tf.reduce_sum(scores)
        batch_size = tf.cast(tf.shape(scores)[0], tf.float32)

        # update our accumulators
        self.total_score.assign_add(batch_sum)
        self.count.assign_add(batch_size)

    def result(self):
        return tf.math.divide_no_nan(self.total_score, self.count)

    def reset_state(self):
        self.total_score.assign(0.0)
        self.count.assign(0.0)
